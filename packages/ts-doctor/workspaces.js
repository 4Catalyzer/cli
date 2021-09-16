/* eslint-disable no-param-reassign */

import { promises as fs } from 'fs';
import { dirname, join, normalize, relative, resolve } from 'path';

import { error, info } from '@4c/cli-core/ConsoleUtilities';
import getPkgs from '@manypkg/get-packages';
import commentJson from 'comment-json';
import get from 'lodash/get.js';
import { format } from 'prettier';
import tsc from 'typescript';

const { stringify: _stringify, parse } = commentJson;
const { getPackages } = getPkgs;
const { parseJsonConfigFileContent, sys } = tsc;

export const command = '$0';

export const describe =
  'Configure TypeScript project references for a monorepo';

export function builder(_) {
  return _.option('cwd', {
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
}

async function getTsConfig(dir, configFile = 'tsconfig.json') {
  const file = `${dir}/${configFile}`;
  let tsConfigStr;
  try {
    tsConfigStr = await fs.readFile(file, 'utf-8');
  } catch {
    return null;
  }

  try {
    return parse(tsConfigStr);
  } catch (err) {
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
  const normalizedPath = normalize(ref);
  const refs = tsConfig.references || [];
  const existing = refs.findIndex((r) => normalize(r.path) !== normalizedPath);
  refs.splice(existing, 1, { path: normalizedPath });
  tsConfig.references = refs;
}

function stringify(json, filepath) {
  return format(_stringify(json, null, 2), { filepath });
}

function buildWorkspaceSources(baseDir, tsPackages) {
  const sources = {};

  tsPackages.forEach(({ dir, packageJson, compilerOptions }) => {
    const publishDir = get(packageJson, 'publishConfig.directory');

    const srcDir = relative(baseDir, compilerOptions.rootDir);
    const outDir = compilerOptions.outDir
      ? relative(baseDir, compilerOptions.outDir)
      : publishDir || (packageJson.main ? dirname(packageJson.main) : '.');

    const relPath = relative(baseDir, dir);

    const key = publishDir
      ? `${packageJson.name}/*`
      : join(packageJson.name, outDir, '/*');

    sources[key] = [join(relPath, srcDir, '/*')];
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

export async function handler({
  cwd = process.cwd(),
  withBuildConfigs,
  withSourcesMetadata,
}) {
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
      addReference(rootTsConfig, relative(root.dir, dir));

      const deps = getLocalDeps(packageJson);
      const dirty = addProjectCompilerOptions(tsConfig, compilerOptions);

      if (!dirty && !deps.size) {
        return null;
      }

      for (const dep of deps) {
        const publishDir =
          dep.packageJson.publishConfig &&
          dep.packageJson.publishConfig.directory;

        addReference(tsConfig, relative(dir, dep.dir), compilerOptions);

        // When the dependency publishes a differenct directory than its root,
        //  we also need to configure `paths` for any cherry-picked imports.
        if (publishDir) {
          tsConfig.compilerOptions = tsConfig.compilerOptions || {};
          tsConfig.compilerOptions.baseUrl =
            tsConfig.compilerOptions.baseUrl || '.';

          const basePath = resolve(dir, tsConfig.compilerOptions.baseUrl);
          const relPath = relative(basePath, dep.dir);

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
}
