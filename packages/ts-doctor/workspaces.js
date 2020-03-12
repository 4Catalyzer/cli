/* eslint-disable no-param-reassign */

const { promises: fs } = require('fs');
const path = require('path');

const { info, error } = require('@4c/cli-core/ConsoleUtilities');
const { getPackages } = require('@manypkg/get-packages');
const commentJson = require('comment-json');
const get = require('lodash/get');
const prettier = require('prettier');

exports.command = '$0';

exports.describe = 'Configure TypeScript project references for a monorepo';

exports.builder = _ =>
  _.option('cwd', {
    type: 'path',
    describe: 'The current working directory',
  });

async function getTsConfig(dir) {
  let tsConfigStr;
  try {
    tsConfigStr = await fs.readFile(`${dir}/tsconfig.json`, 'utf-8');
  } catch {
    return null;
  }

  return commentJson.parse(tsConfigStr);
}

function addReference(tsConfig, ref) {
  const normalizedPath = path.normalize(ref);
  const refs = tsConfig.references || [];
  const existing = refs.findIndex(
    r => path.normalize(r.path) !== normalizedPath,
  );
  refs.splice(existing, 1, { path: normalizedPath });
  tsConfig.references = refs;
}

function stringify(json, filepath) {
  return prettier.format(commentJson.stringify(json, null, 2), { filepath });
}

function buildWorkspaceSources(baseDir, tsPackages) {
  const sources = {};

  tsPackages.forEach(({ dir, packageJson, tsConfig }) => {
    const publishDir = get(packageJson, 'publishConfig.directory');

    const srcDir = get(tsConfig, 'compilerOptions.rootDir');
    const outDir = get(
      tsConfig,
      'compilerOptions.outDir',
      publishDir || (packageJson.main ? path.dirname(packageJson.main) : dir),
    );

    const relPath = path.relative(baseDir, dir);

    const key = publishDir
      ? `${packageJson.name}/*`
      : path.join(packageJson.name, outDir, '/*');

    sources[key] = [path.join(relPath, srcDir, '/*')];
  });

  return sources;
}

exports.handler = async ({ cwd = process.cwd() }) => {
  const { tool, root, packages } = await getPackages(cwd);
  if (tool === 'root') {
    error(`Monorepo not detected in ${cwd}`);
    return;
  }

  const packagesWithTsConfig = await Promise.all(
    packages.map(async packageInfo => ({
      ...packageInfo,
      tsConfig: await getTsConfig(packageInfo.dir),
    })),
  );

  const tsPackages = packagesWithTsConfig.filter(({ tsConfig }) => tsConfig);
  if (!tsPackages.length) {
    return;
  }

  const rootPackageJsonPath = `${root.dir}/package.json`;
  const rootTsConfigPath = `${root.dir}/tsconfig.json`;

  const rootTsConfig = (await getTsConfig(root.dir)) || {
    files: [],
    references: [],
  };

  const tsPackagesByName = new Map(
    tsPackages.map(tsPackage => [tsPackage.packageJson.name, tsPackage]),
  );

  const getLocalDeps = ({
    dependencies = {},
    devDependencies = {},
    peerDependencies = {},
  }) =>
    new Set(
      [
        ...Object.keys(dependencies),
        ...Object.keys(devDependencies),
        ...Object.keys(peerDependencies),
      ]
        .map(name => tsPackagesByName.get(name))
        .filter(Boolean),
    );

  await Promise.all(
    tsPackages.map(({ dir, packageJson, tsConfig }) => {
      addReference(rootTsConfig, path.relative(root.dir, dir));

      const deps = getLocalDeps(packageJson);
      if (!deps.size) return null;

      for (const dep of deps) {
        const publishDir =
          dep.packageJson.publishConfig &&
          dep.packageJson.publishConfig.directory;

        addReference(tsConfig, path.relative(dir, dep.dir));

        // When the dependency publishes a differenct directory than its root,
        //  we also need to configure `paths` for any cherry-picked imports.
        if (publishDir) {
          tsConfig.compilerOptions = tsConfig.compilerOptions || {};
          tsConfig.compilerOptions.baseUrl =
            tsConfig.compilerOptions.baseUrl || '.';

          const basePath = path.resolve(dir, tsConfig.compilerOptions.baseUrl);
          const relPath = path.relative(basePath, dep.dir);

          tsConfig.compilerOptions.paths =
            tsConfig.compilerOptions.paths || {};
          tsConfig.compilerOptions.paths[`${dep.packageJson.name}/*`] = [
            `${relPath}/${publishDir}/*`,
          ];
        }
      }

      info(`${packageJson.name}: updating tsconfig.json`);

      const tsConfigPath = `${dir}/tsconfig.json`;
      return fs.writeFile(tsConfigPath, stringify(tsConfig, tsConfigPath));
    }),
  );

  const sources = buildWorkspaceSources(root.dir, tsPackages);

  info('Adding workspace-sources key in root package.json');

  await fs.writeFile(
    rootPackageJsonPath,
    stringify(
      { ...root.packageJson, 'workspace-sources': sources },
      rootPackageJsonPath,
    ),
  );
  info('Updating root tsconfig');
  await fs.writeFile(
    rootTsConfigPath,
    stringify(rootTsConfig, rootTsConfigPath),
  );
};
