/* eslint-disable no-param-reassign */

const { promises: fs } = require('fs');
const path = require('path');

const {
  detectMonoRepo,
  getWorkspaces,
  getTSConfig,
  commentJson,
} = require('@4c/cli-core/ConfigUtilities');
const { info, error } = require('@4c/cli-core/ConsoleUtilities');
const get = require('lodash/get');
const prettier = require('prettier');

exports.command = 'workspaces';

exports.describe = 'Configure TypeScript project references for a mono repo';

exports.builder = _ =>
  _.option('cwd', {
    type: 'path',
    describe: 'The current working directory',
  });

function addReference(tsconfig, ref) {
  const normalizedPath = path.normalize(ref);
  const refs = tsconfig.references || [];
  const existing = refs.findIndex(
    r => path.normalize(r.path) !== normalizedPath,
  );
  refs.splice(existing, 1, { path: normalizedPath });
  tsconfig.references = refs;
}

function stringify(json, filepath) {
  return prettier.format(commentJson.stringify(json, null, 2), { filepath });
}

function buildWorkspaceSources(baseDir, workspaces) {
  const sources = {};

  workspaces.forEach(ws => {
    const publishDir = get(ws, 'config.publishConfig.directory');

    const srcDir = get(ws, 'tsconfig.compilerOptions.rootDir');
    const outDir = get(
      ws,
      'tsconfig.compilerOptions.outDir',
      publishDir || (ws.config.main ? path.dirname(ws.config.main) : ws.dir),
    );

    const relPath = path.relative(baseDir, ws.dir);

    const key = publishDir ? `${ws.name}/*` : path.join(ws.name, outDir, '/*');

    sources[key] = [path.join(relPath, srcDir, '/*')];
  });

  return sources;
}

exports.handler = async ({ cwd = process.cwd() }) => {
  const allWorkspaces = await getWorkspaces({ cwd, tools: 'yarn' });
  if (!allWorkspaces) {
    error(`Workspace not detected in ${cwd}`);
    return;
  }

  const workspaces = allWorkspaces
    .map(workspace => ({
      ...workspace,
      tsconfig: getTSConfig(workspace.dir),
    }))
    .filter(workspace => workspace.tsconfig);
  if (!workspaces.length) return;

  const { root } = await detectMonoRepo(cwd);

  const rootPkgJsonPath = `${root}/package.json`;
  const rootTsconfigPath = `${root}/tsconfig.json`;

  const rootPkgJson = require(rootPkgJsonPath);
  const rootTsconfig = getTSConfig(root) || {
    files: [],
    references: [],
  };

  const workspaceByName = new Map(workspaces.map(ws => [ws.name, ws]));

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
        .map(k => workspaceByName.get(k)),
        .filter(Boolean)
    );

  await Promise.all(
    workspaces.map(({ name, dir, config, tsconfig }) => {
      addReference(rootTsconfig, path.relative(root, dir));

      const deps = getLocalDeps(config);
      if (!deps.size) return null;

      for (const dep of deps) {
        const publishDir =
          dep.config.publishConfig && dep.config.publishConfig.directory;

        addReference(tsconfig, path.relative(dir, dep.dir));

        // When the dependency publishes a differenct directory than it's root
        // we also need to configure a `paths` for any cherry-picked imports
        if (publishDir) {
          tsconfig.compilerOptions = tsconfig.compilerOptions || {};
          tsconfig.compilerOptions.baseUrl =
            tsconfig.compilerOptions.baseUrl || '.';

          const basePath = path.resolve(dir, tsconfig.compilerOptions.baseUrl);
          const relPath = path.relative(basePath, dep.dir);

          tsconfig.compilerOptions.paths =
            tsconfig.compilerOptions.paths || {};
          tsconfig.compilerOptions.paths[`${dep.name}/*`] = [
            `${relPath}/${publishDir}/*`,
          ];
        }
      }

      info(`${name}: updating tsconfig.json`);

      const tsconfigPath = `${dir}/tsconfig.json`;
      return fs.writeFile(tsconfigPath, stringify(tsconfig, tsconfigPath));
    }),
  );

  const sources = buildWorkspaceSources(root, workspaces);

  info('Adding workspace-sources key in root package.json');

  await fs.writeFile(
    rootPkgJsonPath,
    stringify(
      { ...rootPkgJson, 'workspace-sources': sources },
      rootPkgJsonPath,
    ),
  );
  info('Updating root tsconfig');
  await fs.writeFile(
    rootTsconfigPath,
    stringify(rootTsconfig, rootTsconfigPath),
  );
};
