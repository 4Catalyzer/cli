const path = require('path');
const { debuglog } = require('util');
const fs = require('fs-extra');
const execa = require('execa');
const Listr = require('listr');
const { chalk, symbols } = require('@4c/cli-core/ConsoleUtilities');

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

function runBabel(args, passthrough) {
  babelCmd = babelCmd || getCli('@babel/cli', 'babel');

  const builtArgs = args
    .filter(Boolean)
    .concat(['--ignore', '**/__tests__/**,**/__mocks__/**,**/*.d.ts']);

  if (passthrough) builtArgs.push(...passthrough);

  debug(babelCmd, ...builtArgs);
  return run(babelCmd, builtArgs);
}

const safeToDelete = (dir, cwd = process.cwd()) => {
  const resolvedDir = path.isAbsolute(dir) ? dir : path.resolve(cwd, dir);

  return resolvedDir.startsWith(cwd) && resolvedDir !== cwd;
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
}) => {
  const pkg = await fs.readJson('package.json');

  const buildTypes = types && !!fs.existsSync(`tsconfig.json`);
  const tscCmd = buildTypes && getCli('typescript', 'tsc');

  if (!outDir) {
    // eslint-disable-next-line no-param-reassign
    outDir = pkg.main && path.dirname(pkg.main);
  }

  let esmRoot;
  let esmRootInOutDir = false;
  if (esm !== false) {
    esmRoot = pkg.module && path.dirname(pkg.module);

    if (esm === true && !esmRoot) {
      throw new Error(
        '--esm argument provided but no `module` entrypoint was specified in the package.json',
      );
    }

    if (esmRoot) esmRootInOutDir = esmRoot.startsWith(outDir);
  }

  if (!outDir && !esmRoot) {
    throw new Error(
      '--out-dir or --esm was not provided and none could not be inferred from main fields',
    );
  }

  function getTypeTask(out) {
    return async (_, task) => {
      if (buildTypes) {
        await run(tscCmd, ['--emitDeclarationOnly', '--outDir', out]);
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
      {
        title: 'Building CommonJS',
        task: () =>
          new Listr([
            {
              title: 'Compiling with Babel',
              skip: () => !!onlyTypes,
              task: () =>
                runBabel(
                  [
                    ...patterns,
                    '--out-dir',
                    outDir,
                    clean && safeToDelete(outDir) && '--delete-dir-on-start',
                    '-x',
                    extensions.join(','),
                  ],
                  passthrough,
                ),
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
    ],
    { concurrent: !esmRootInOutDir },
  );

  if (esmRoot) {
    tasks.add({
      title: 'Building ES Module files…',
      task: () =>
        new Listr([
          {
            title: 'Compiling with Babel',
            skip: () => !!onlyTypes,
            task: () =>
              runBabel(
                [
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
                ],
                passthrough,
              ),
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
    });
  }

  try {
    await tasks.run();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
};
