const path = require('path');
const { debuglog } = require('util');
const fs = require('fs-extra');
const execa = require('execa');
const Listr = require('listr');
const { detectMonoRepo } = require('@4c/cli-core/ConfigUtilities');
const { chalk, symbols, info } = require('@4c/cli-core/ConsoleUtilities');
const { copy, copyRest } = require('./copy');

const debug = debuglog('@4c/build');

function getCli(pkg, cmd) {
  const pkgPath = require.resolve(`${pkg}/package.json`);
  const { bin } = fs.readJsonSync(pkgPath);
  const loc = path.join(path.dirname(pkgPath), bin[cmd]);

  return loc;
}

exports.command = '$0 [patterns..]';

exports.describe =
  'Compiles code via babel as well as Typescript type def files when appropriate.\n\n' +
  'Boolean flags can be negated by prefixing with --no-* (--foo, --no-foo)';

exports.builder = _ =>
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
    });

function run(...args) {
  return execa(...args, {
    env: { FORCE_COLOR: true },
  }).catch(err => {
    throw new Error(
      `\n${symbols.error} ${chalk.redBright(
        'There was a problem running the build command:',
      )}\n${err.stdout}\n${err.stderr}`,
    );
  });
}

let babelCmd;

const safeToDelete = (dir, cwd = process.cwd()) => {
  const resolvedDir = path.isAbsolute(dir) ? dir : path.resolve(cwd, dir);

  return resolvedDir.startsWith(cwd) && resolvedDir !== cwd;
};

const getTsconfig = () => {
  if (fs.existsSync('./tsconfig.build.json')) return './tsconfig.build.json';
  if (fs.existsSync('./tsconfig.json')) return './tsconfig.json';
  return null;
};

exports.handler = async ({
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
}) => {
  const monoRepo = await detectMonoRepo();
  const pkg = await fs.readJson('package.json');
  const tsconfig = types && (options.tsconfig || getTsconfig());

  const buildTypes = tsconfig && !!fs.existsSync(tsconfig);
  const tscCmd = buildTypes && getCli('typescript', 'tsc');

  if (tsconfig && !options.tsconfig) {
    info(
      `Using "${tsconfig}" to compile types. Pass --tsconfig to override this default\n`,
    );
  }
  if (!outDir) {
    // eslint-disable-next-line no-param-reassign
    outDir = pkg.main && path.dirname(pkg.main);
  }

  const isSameEntry = pkg.module && pkg.main && pkg.module === pkg.main;

  let esmRoot;
  let esmRootInOutDir = false;
  if (esm !== false) {
    esmRoot = pkg.module && path.dirname(pkg.module);

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

    // try and be accepting of possible root config for monorepos
    if (monoRepo) builtArgs.push('--root-mode', 'upward-optional');
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
};
