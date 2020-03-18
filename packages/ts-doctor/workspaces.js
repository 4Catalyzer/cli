/* eslint-disable no-param-reassign */

const { promises: fs } = require('fs');
const path = require('path');

const { info, error } = require('@4c/cli-core/ConsoleUtilities');
const { getPackages } = require('@manypkg/get-packages');
const commentJson = require('comment-json');
const get = require('lodash/get');
const prettier = require('prettier');
const { parseJsonConfigFileContent, sys } = require('typescript');

exports.command = '$0';

exports.describe = 'Configure TypeScript project references for a monorepo';

exports.builder = (_) =>
  _.option('cwd', {
    type: 'path',
    describe: 'The current working directory',
  })
    .option('with-build-configs', {
      type: 'boolean',
      describe:
        'Creates a tsconfig.build.json file in each package configured for buildind .d.ts files per package. ' +
        'Useful for Babel based workflows, where `tsc` is only used to build type defs, not compile source. ' +
        'This is unfortunately necessary because of how compiler flags interact badly with composite projects, making ' +
        'it impossible to build _just_ type definitions from the root.',
    })
    .option('with-sources-metadata', {
      type: 'boolean',
      describe:
        'Adds a workspace-sources key to the root package.json with metadata about how imports made to source files',
    });

async function getTsConfig(dir, configFile = 'tsconfig.json') {
  const file = `${dir}/${configFile}`;
  let tsConfigStr;
  try {
    tsConfigStr = await fs.readFile(file, 'utf-8');
  } catch {
    console.log(file, 'HI');
    return null;
  }

  try {
    return commentJson.parse(tsConfigStr);
  } catch (err) {
    console.log(tsConfigStr);
    err.message = `in ${file}\n\n${err.message}`;
    throw err;
  }
}

function addProjectCompilerOptions(tsConfig, compilerOptions) {
  let dirty = false;

  const nextOptions = tsConfig.compilerOptions || {};

  if (!compilerOptions.composite) {
    dirty = true;
    nextOptions.composite = true;
  }
  if (!compilerOptions.declarationMap) {
    dirty = true;
    nextOptions.declarationMap = true;
  }
  if (!dirty) return false;
  tsConfig.compilerOptions = nextOptions;
  return true;
}

function addReference(tsConfig, ref) {
  const normalizedPath = path.normalize(ref);
  const refs = tsConfig.references || [];
  const existing = refs.findIndex(
    (r) => path.normalize(r.path) !== normalizedPath,
  );
  refs.splice(existing, 1, { path: normalizedPath });
  tsConfig.references = refs;
}

function stringify(json, filepath) {
  return prettier.format(commentJson.stringify(json, null, 2), { filepath });
}

function buildWorkspaceSources(baseDir, tsPackages) {
  const sources = {};

  tsPackages.forEach(({ dir, packageJson, compilerOptions }) => {
    const publishDir = get(packageJson, 'publishConfig.directory');

    const srcDir = path.relative(baseDir, compilerOptions.rootDir);
    const outDir = compilerOptions.outDir
      ? path.relative(baseDir, compilerOptions.outDir)
      : publishDir ||
        (packageJson.main ? path.dirname(packageJson.main) : '.');

    const relPath = path.relative(baseDir, dir);

    const key = publishDir
      ? `${packageJson.name}/*`
      : path.join(packageJson.name, outDir, '/*');

    sources[key] = [path.join(relPath, srcDir, '/*')];
  });

  return sources;
}
async function resolveTsConfig(dir, configFile = 'tsconfig.json') {
  const tsConfig = await getTsConfig(dir, configFile);
  // seems to mutate the input...
  const compilerOptions = parseJsonConfigFileContent(
    { ...(tsConfig || {}) },
    sys,
    dir,
  ).options;

  return { tsConfig, compilerOptions };
}

async function writeBuildConfig(dir) {
  const configFile = 'tsconfig.build.json';

  const config = await resolveTsConfig(dir, configFile);

  const tsConfig = config.tsConfig || { extend: '.' };

  tsConfig.compilerOptions = tsConfig.compilerOptions || {};
  tsConfig.compilerOptions.composite = false;

  const tsBuildConfigPath = `${dir}/${configFile}`;

  await fs.writeFile(
    tsBuildConfigPath,
    stringify(tsConfig, tsBuildConfigPath),
  );
}

exports.handler = async ({
  cwd = process.cwd(),
  withBuildConfigs,
  withSourcesMetadata,
}) => {
  const { tool, root, packages } = await getPackages(cwd);
  if (tool === 'root') {
    error(`Monorepo not detected in ${cwd}`);
    return;
  }

  const packagesWithTsConfig = await Promise.all(
    packages.map(async (packageInfo) => ({
      ...packageInfo,
      ...(await resolveTsConfig(packageInfo.dir)),
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
    tsPackages.map((tsPackage) => [tsPackage.packageJson.name, tsPackage]),
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
        .map((name) => tsPackagesByName.get(name))
        .filter(Boolean),
    );

  await Promise.all(
    tsPackages.map(({ dir, packageJson, tsConfig, compilerOptions }) => {
      addReference(rootTsConfig, path.relative(root.dir, dir));

      const deps = getLocalDeps(packageJson);
      const dirty = addProjectCompilerOptions(tsConfig, compilerOptions);

      if (!dirty && !deps.size) {
        return null;
      }

      for (const dep of deps) {
        const publishDir =
          dep.packageJson.publishConfig &&
          dep.packageJson.publishConfig.directory;

        addReference(tsConfig, path.relative(dir, dep.dir), compilerOptions);

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

      return Promise.all([
        fs.writeFile(tsConfigPath, stringify(tsConfig, tsConfigPath)),
        withBuildConfigs && writeBuildConfig(dir),
      ]);
    }),
  );

  const nextRoot = { ...root.packageJson };
  if (withSourcesMetadata) {
    info('Adding workspace-sources key in root package.json');

    nextRoot['workspace-sources'] = buildWorkspaceSources(
      root.dir,
      tsPackages,
    );
  }

  await fs.writeFile(
    rootPackageJsonPath,
    stringify(nextRoot, rootPackageJsonPath),
  );
  info('Updating root tsconfig');
  await fs.writeFile(
    rootTsConfigPath,
    stringify(rootTsConfig, rootTsConfigPath),
  );
};
