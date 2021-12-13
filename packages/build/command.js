import { createRequire } from 'module';
import { dirname, isAbsolute, join, resolve } from 'path';
import { debuglog } from 'util';

import { chalk, info, symbols } from '@4c/cli-core/ConsoleUtilities';
import { getPackages } from '@manypkg/get-packages';
import { execa } from 'execa';
import fsExtra from 'fs-extra';
import Listr from 'listr';

import { copy, copyRest } from './copy.js';

const require = createRequire(import.meta.url);

const debug = debuglog('@4c/build');
const { existsSync, readJson, readJsonSync } = fsExtra;

function getCli(pkg, cmd) {
  const pkgPath = require.resolve(`${pkg}/package.json`);
  const { bin } = readJsonSync(pkgPath);
  const loc = join(dirname(pkgPath), bin[cmd]);

  return loc;
}

export const command = '$0 [patterns..]';

export const describe =
  'Compiles code via babel as well as Typescript type def files when appropriate.\n\n' +
  'Boolean flags can be negated by prefixing with --no-* (--foo, --no-foo)';

export function builder(_) {
  return (
    _.positional('patterns', { default: ['src'] })
      .option('out-dir', {
        alias: 'd',
        type: 'string',
      })
      .option('type-dir', {
        type: 'string',
        describe:
          'The location of any additional type defs, to be copied to the output folders',
      })
      .option('esm', {
        type: 'boolean',
        default: undefined,
        describe: 'Builds an esm build',
      })
      .option('extensions', {
        alias: 'x',
        default: ['.js', '.ts', '.tsx'],
        describe: 'The extensions of files to compile',
      })
      .option('clean', {
        type: 'boolean',
        default: true,
        describe: 'Remove out directory before building',
      })
      .option('tsconfig', {
        type: 'path',
        describe: 'The tsconfig.json location to use for type defs',
      })
      .option('only-types', {
        type: 'boolean',
        describe: 'Compile only the type definitions',
      })
      // off with `no-types`
      .option('types', {
        type: 'boolean',
        default: true,
        describe: 'Compile type defs',
      })
      .option('copy-files', {
        type: 'boolean',
        default: true,
        describe: 'When compiling a directory copy over non-compilable files',
      })
      // so we can pass anything after -- to babel
      .parserConfiguration({
        'populate--': true,
      })
  );
}

function run(...args) {
  return execa(...args, {
    env: { FORCE_COLOR: true },
  }).catch((err) => {
    throw new Error(
      `\n${symbols.error} ${chalk.redBright(
        'There was a problem running the build command:',
      )}\n${err.stdout}\n${err.stderr}`,
    );
  });
}

let babelCmd;

const safeToDelete = (dir, cwd = process.cwd()) => {
  const resolvedDir = isAbsolute(dir) ? dir : resolve(cwd, dir);

  return resolvedDir.startsWith(cwd) && resolvedDir !== cwd;
};

const getTsconfig = () => {
  if (existsSync('./tsconfig.build.json')) return './tsconfig.build.json';
  if (existsSync('./tsconfig.json')) return './tsconfig.json';
  return null;
};

export async function handler({
  patterns,
  esm,
  outDir,
  clean,
  types,
  typeDir,
  onlyTypes,
  extensions,
  copyFiles,
  '--': passthrough,
  ...options
}) {
  const { tool } = await getPackages();
  const monorepo = tool !== 'root';

  const pkg = await readJson('package.json');
  const tsconfig = types && (options.tsconfig || getTsconfig());

  const buildTypes = tsconfig && !!existsSync(tsconfig);
  const tscCmd = buildTypes && getCli('typescript', 'tsc');

  if (tsconfig && !options.tsconfig) {
    info(
      `Using "${tsconfig}" to compile types. Pass --tsconfig to override this default\n`,
    );
  }
  if (!outDir) {
    // eslint-disable-next-line no-param-reassign
    outDir = pkg.main && dirname(pkg.main);
  }

  const isSameEntry = pkg.module && pkg.main && pkg.module === pkg.main;

  let esmRoot;
  let esmRootInOutDir = false;
  if (esm !== false) {
    esmRoot = pkg.module && dirname(pkg.module);

    if (esm === true && !esmRoot) {
      throw new Error(
        '--esm argument provided but no `module` entrypoint was specified in the package.json',
      );
    }

    if (esmRoot) {
      esmRootInOutDir = !isSameEntry && esmRoot.startsWith(outDir);
    }
  }

  if (!outDir && !esmRoot) {
    throw new Error(
      '--out-dir or --esm was not provided and none could not be inferred from main fields',
    );
  }

  function runBabel(args) {
    babelCmd = babelCmd || getCli('@babel/cli', 'babel');

    const builtArgs = args
      .filter(Boolean)
      .concat(['--ignore', '**/__tests__/**,**/__mocks__/**,**/*.d.ts']);

    // Try to be accepting of possible root config for monorepos.
    if (monorepo) builtArgs.push('--root-mode', 'upward-optional');
    if (passthrough) builtArgs.push(...passthrough);

    debug(babelCmd, ...builtArgs);
    return run(babelCmd, builtArgs);
  }

  function getTypeTask(out) {
    return async (_, task) => {
      if (buildTypes) {
        await run(tscCmd, [
          '-p',
          tsconfig,
          '--emitDeclarationOnly',
          '--outDir',
          out,
        ]);
      }
      if (typeDir) {
        // eslint-disable-next-line no-param-reassign
        task.output = 'Copying type def files';
        await copy(['**/*.d.ts'], typeDir, out);
      }
    };
  }

  const tasks = new Listr(
    [
      outDir &&
        !isSameEntry && {
          title: `Building ${isSameEntry ? 'Files' : 'CommonJS'}`,
          task: () =>
            new Listr([
              {
                title: 'Compiling with Babel',
                skip: () => !!onlyTypes,
                task: () =>
                  runBabel([
                    ...patterns,
                    '--out-dir',
                    outDir,
                    clean && safeToDelete(outDir) && '--delete-dir-on-start',
                    '-x',
                    extensions.join(','),
                  ]),
              },
              {
                title: 'Copying files',
                skip: () => !copyFiles,
                task: () => copyRest(patterns, outDir, extensions),
              },
              {
                title: 'Building types',
                skip: () => !buildTypes && !typeDir,
                task: getTypeTask(outDir),
              },
            ]),
        },
      esmRoot && {
        title: 'Building ES Module files',
        task: () =>
          new Listr([
            {
              title: 'Compiling with Babel',
              skip: () => !!onlyTypes,
              task: () =>
                runBabel([
                  ...patterns,
                  '--out-dir',
                  esmRoot,
                  clean &&
                    !esmRootInOutDir &&
                    safeToDelete(esmRoot) &&
                    '--delete-dir-on-start',
                  '--env-name',
                  'esm',
                  '-x',
                  extensions.join(','),
                ]),
            },
            {
              title: 'Copying files',
              skip: () => !copyFiles,
              task: () => copyRest(patterns, esmRoot, extensions),
            },
            {
              title: 'Building types',
              skip: () => !buildTypes && !typeDir,
              task: getTypeTask(esmRoot),
            },
          ]),
      },
    ].filter(Boolean),
    { concurrent: !esmRootInOutDir },
  );

  try {
    await tasks.run();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
