import { chalk, error } from '@4c/cli-core/ConsoleUtilities';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
// eslint-disable-next-line import/no-extraneous-dependencies
import get from 'lodash/get.js';
import webpack from 'webpack';
import WebpackNotifierPlugin from 'webpack-notifier';
import WebpackBar from 'webpackbar';

import { formatTitle, printer } from './errors/index.js';

function configureRelayPluginReporter(config) {
  const { plugins = [] } = config;
  const pluginInstance = plugins.find(
    (p) =>
      p.constructor.name === 'RelayCompilerWebpackPlugin' &&
      !p.options.getReporter,
  );

  if (pluginInstance) {
    pluginInstance.options.getReporter = (logger) => ({
      reportMessage(message) {
        if (logger) logger.log(message);
      },
      reportTime(_name, _ms) {},

      reportError(_location, err) {
        // log just the message since webpack mangles the Error object
        logger.error(err.message);
      },
    });
  }
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

export default async function createCompiler({
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

  configureRelayPluginReporter(processedConfig);

  try {
    compiler = webpack({
      ...processedConfig,
      plugins: [
        ...(processedConfig.plugins || []),
        new WebpackBar({
          name: appName || 'App',
          reporters: [showProgress ? 'fancy' : 'basic'],
        }),
        new WebpackNotifierPlugin({
          title: appName,
          excludeWarnings: true,
          skipFirstNotification: true,
        }),
      ],
    });
  } catch (err) {
    error('Failed to compile.');
    console.log();
    console.log(err.message || err);
    console.log();
    process.exit(1);
  }

  const printErrors = await printer(compiler);

  function printAppInfo(severity = 'info') {
    console.log();
    console.log(
      `${formatTitle(severity, 'I')} ` +
        `Your application is running here: ${urls.localUrlForTerminal}`,
    );
    console.log();
  }

  let tsMessagesPromise;
  let tsMessagesResolver;

  function resolveTsMessages(messages) {
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
      logging: 'error',
    });

    if (statsData.logging.RelayCompilerPlugin) {
      const relayErrors = new Set();

      statsData.logging.RelayCompilerPlugin.entries.forEach((e) =>
        relayErrors.add(e.args[0]),
      );

      statsData.errors.push(
        ...Array.from(relayErrors, (message) => ({
          origin: 'relay-compiler',
          message,
        })),
      );
    }

    if (typeCheckerPlugin && statsData.errors.length === 0) {
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

    let severity = 'info';
    if (statsData.errors.length) {
      severity = 'error';
      printErrors(statsData.errors, 'error');
    } else if (statsData.warnings.length) {
      severity = 'warning';
      printErrors(statsData.warnings, 'warning');
    }

    printAppInfo(severity);
  });

  return compiler;
}
