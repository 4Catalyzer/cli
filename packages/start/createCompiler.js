const { chalk, error } = require('@4c/cli-core/ConsoleUtilities');

const passthroughTSFormatter = msg => msg;

function getMaxSeverityErrors(errors) {
  const maxSeverity = errors.reduce(
    (res, curr) => (curr.severity > res ? curr.severity : res),
    0,
  );

  return errors.filter(e => e.severity === maxSeverity);
}

module.exports = function createCompiler({
  appName,
  config,
  devSocket,
  urls,
  useTypeScript,
  webpack,
  progress: showProgress,
}) {
  // lazy load b/c these require webpack
  const WebpackBar = require('webpackbar');
  const WebpackNotifierPlugin = require('webpack-notifier');
  const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
  const transformErrors = require('friendly-errors-webpack-plugin/src/core/transformErrors');
  const formatErrors = require('friendly-errors-webpack-plugin/src/core/formatErrors');
  const colors = require('friendly-errors-webpack-plugin/src/utils/colors');

  const getFormatters = require('./formatters');
  const getTransformers = require('./transformers');

  let compiler;
  try {
    compiler = webpack(config);
  } catch (err) {
    error('Failed to compile.');
    console.log();
    console.log(err.message || err);
    console.log();
    process.exit(1);
  }

  const formatters = getFormatters(compiler);
  const transformers = getTransformers(compiler);

  function printErrors(errors, severity) {
    const topErrors = getMaxSeverityErrors(
      transformErrors(errors, transformers),
    );

    const subtitle =
      severity === 'error'
        ? `Failed to compile with ${topErrors.length} ${severity}s`
        : `Compiled with ${topErrors.length} ${severity}s`;

    console.log(`${colors.formatText(severity, subtitle)}\n\n`);

    formatErrors(topErrors, formatters, severity).forEach(err =>
      console.log(err),
    );
  }

  function printAppInfo() {
    console.log();
    console.log(
      `${colors.formatTitle('info', 'I')} ` +
        `Your application is running here: ${urls.localUrlForTerminal}`,
    );
    console.log();
  }

  const progress = new WebpackBar({
    name: appName || 'App',
    reporters: [showProgress ? 'fancy' : 'basic'],
  });

  const notifier = new WebpackNotifierPlugin({
    title: appName,
    excludeWarnings: true,
    skipFirstNotification: true,
  });

  progress.apply(compiler);
  notifier.apply(compiler);

  let isTsAsync = false;
  let tsMessagesPromise;
  let tsMessagesResolver;

  if (useTypeScript) {
    // doesn't rely on the plugins instances being deduped
    let forkTsCheckerWebpackPlugin = compiler.options.plugins.find(
      p => p.constructor.name === 'ForkTsCheckerWebpackPlugin',
    );

    if (!forkTsCheckerWebpackPlugin) {
      forkTsCheckerWebpackPlugin = new ForkTsCheckerWebpackPlugin({
        async: true,
        silent: true,
        tslint: false,
        compilerOptions: {
          noUnusedLocals: false,
          noUnusedParameters: false,
        },
      });
      forkTsCheckerWebpackPlugin.apply(compiler);
    }

    forkTsCheckerWebpackPlugin.silent = true;
    forkTsCheckerWebpackPlugin.formatter = passthroughTSFormatter;

    isTsAsync = !!forkTsCheckerWebpackPlugin.options.async;

    // in the async case forkTsChecker will emit errors _after_ the compilation
    // has already happened so we need wait and log them ourselves
    if (isTsAsync) {
      compiler.hooks.beforeCompile.tap('beforeCompile', () => {
        tsMessagesPromise = new Promise(resolve => {
          tsMessagesResolver = msgs => resolve(msgs);
        });
      });

      forkTsCheckerWebpackPlugin.constructor
        .getCompilerHooks(compiler)
        .receive.tap('afterTypeScriptCheck', (diagnostics, lints) => {
          const allMsgs = [...diagnostics, ...lints];

          // this is the format these errors are inserted in when not async
          const format = msg => ({
            file: msg.file,
            message: msg,
            location: {
              line: msg.line,
              character: msg.character,
            },
          });

          tsMessagesResolver({
            errors: allMsgs.filter(m => m.severity === 'error').map(format),
            warnings: allMsgs
              .filter(m => m.severity === 'warning')
              .map(format),
          });
        });
    }
  }

  // "done" event fires when Webpack has finished recompiling the bundle.
  // Whether or not you have warnings or errors, you will get this event.
  compiler.hooks.done.tap('done', async stats => {
    const statsData = stats.toJson({
      all: false,
      warnings: true,
      errors: true,
    });

    if (isTsAsync && statsData.errors.length === 0) {
      const delayedMsg = setTimeout(() => {
        console.log(chalk.yellow('waiting for typecheck results...'));
        console.log();
      }, 100);
      const messages = await tsMessagesPromise;
      clearTimeout(delayedMsg);

      statsData.errors.push(...messages.errors);
      statsData.warnings.push(...messages.warnings);

      if (messages.errors.length > 0) {
        devSocket.errors(messages.errors);
      } else if (messages.warnings.length > 0) {
        devSocket.warnings(messages.warnings);
      }
    }

    if (statsData.errors.length) {
      printErrors(statsData.errors, 'error');
    } else if (statsData.warnings.length) {
      printErrors(statsData.warnings, 'warning');
    }

    printAppInfo();
  });

  return compiler;
};
