const { chalk, error } = require('@4c/cli-core/ConsoleUtilities');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const formatErrors = require('friendly-errors-webpack-plugin/src/core/formatErrors');
const transformErrors = require('friendly-errors-webpack-plugin/src/core/transformErrors');
const colors = require('friendly-errors-webpack-plugin/src/utils/colors');
// eslint-disable-next-line import/no-extraneous-dependencies
const get = require('lodash/get');
const webpack = require('webpack');
const WebpackNotifierPlugin = require('webpack-notifier');
const WebpackBar = require('webpackbar');

const getFormatters = require('./formatters');
const getTransformers = require('./transformers');

function getMaxSeverityErrors(errors) {
  const maxSeverity = errors.reduce(
    (res, curr) => (curr.severity > res ? curr.severity : res),
    0,
  );

  return errors.filter((e) => e.severity === maxSeverity);
}

function configureTypeChecker(config) {
  if (Array.isArray(config)) return config.map(configureTypeChecker);

  const { plugins = [], ...rest } = config;

  const index = plugins.findIndex(
    (p) => p.constructor.name === 'ForkTsCheckerWebpackPlugin',
  );

  if (index > -1 && !plugins[index].constructor.version)
    throw new Error(
      '@4c/start is only compatible with ForkTsCheckerWebpackPlugin v5 and above',
    );

  const options = index !== -1 ? plugins[index].options : {};

  const plugin = new ForkTsCheckerWebpackPlugin({
    ...options,
    async: true,
    logger: { infrastructure: 'silent', issues: 'silent' },
    typescript: {
      mode: 'write-references',
      ...options.typescript,
      configOverwrite: {
        ...get(options, 'typescript.configOverwrite'),
        compilerOptions: {
          noUnusedLocals: false,
          noUnusedParameters: false,
          ...get(options, 'typescript.configOverwrite.compilerOptions'),
        },
      },
    },
  });

  plugins[index === -1 ? plugins.length : index] = plugin;
  return [{ ...rest, plugins }, plugin];
}

module.exports = function createCompiler({
  appName,
  config,
  devSocket,
  urls,
  useTypeScript,
  progress: showProgress,
}) {
  let compiler;
  const [processedConfig, typeCheckerPlugin] = useTypeScript
    ? configureTypeChecker(config)
    : [config, null];

  try {
    compiler = webpack(processedConfig);
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

    formatErrors(topErrors, formatters, severity).forEach((err) =>
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

  let tsMessagesPromise;
  let tsMessagesResolver;

  function resolveTsMessages(messages) {
    const format = (issue) =>
      Object.assign(new Error(issue.message), {
        type: 'typescript',
        severity: 1000,
        file: issue.file,
        location: issue.location,
        origin: issue.origin,
      });

    // this is the format these errors are inserted in when not async
    tsMessagesResolver({
      errors: messages.filter((m) => m.severity === 'error'),
      warnings: messages.filter((m) => m.severity === 'warning'),
    });
    // empty the queue so the plugin doesn't report them
    return [];
  }

  if (typeCheckerPlugin) {
    // in the async case forkTsChecker will emit errors _after_ the compilation
    // has already happened so we need wait and log them ourselves

    compiler.hooks.beforeCompile.tap('beforeCompile', () => {
      tsMessagesPromise = new Promise((resolve) => {
        tsMessagesResolver = resolve;
      });
    });

    const hooks = typeCheckerPlugin.constructor.getCompilerHooks(compiler);

    hooks.issues.tap('afterTypeScriptCheck', resolveTsMessages);
  }

  // "done" event fires when Webpack has finished recompiling the bundle.
  // Whether or not you have warnings or errors, you will get this event.
  compiler.hooks.done.tap('done', async (stats) => {
    const statsData = stats.toJson({
      all: false,
      warnings: true,
      errors: true,
    });

    if (statsData.errors.length === 0) {
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
