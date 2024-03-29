import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { resolve as _resolve } from 'path';

import { error, isCI, isTTY } from '@4c/cli-core/ConsoleUtilities';
import { parse } from 'dotenv';
import clearConsole from 'react-dev-utils/clearConsole.js';
import noopServiceWorkerMiddleware from 'react-dev-utils/noopServiceWorkerMiddleware.js';
import log from 'webpack-log';

const require = createRequire(import.meta.url);

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

export default async ({
  config: cliConfig = 'webpack.config',
  envFile,
  progress = !isCI(),
  ...cliOptions
}) => {
  // lazy load to use local webpack
  const [WebpackDevServer, { choosePort, prepareUrls }, createCompiler] =
    await Promise.all([
      import('webpack-dev-server').then((m) => m.default),
      import('react-dev-utils/WebpackDevServerUtils.js').then(
        (m) => m.default,
      ),
      import('./createCompiler.js').then((m) => m.default),
    ]);

  try {
    if (envFile) {
      const parsed = parse(readFileSync(envFile));
      Object.entries(parsed).forEach(([key, value]) => {
        process.env[key] = value;
      });
    }

    let config =
      typeof cliConfig === 'string' ? require(_resolve(cliConfig)) : cliConfig;

    if (typeof config === 'function') {
      config = config({}, { ...cliOptions, mode: 'development' });
    }
    // TODO: allow specifying the name/index
    if (Array.isArray(config)) {
      config = config[0];
    }

    if (!config.mode) {
      config.mode = 'development';
    }

    const devServerConfig = config.devServer || {};
    // We attempt to use the default port but if it is busy, we offer the user to
    // run on a different port. `choosePort()` Promise resolves to the next free port.
    const port = await choosePort(HOST, devServerConfig.port || DEFAULT_PORT);

    if (port == null) {
      return null;
    }

    const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';

    const appName = config.name || require(_resolve('./package.json')).name;

    const useTypeScript = cliOptions.typecheck && existsSync(`tsconfig.json`);

    const urls = prepareUrls(protocol, HOST, port);

    const devSocket = {
      warnings: (warnings) =>
        // eslint-disable-next-line no-use-before-define
        devServer.sockWrite(devServer.sockets, 'warnings', warnings),
      errors: (errors) =>
        // eslint-disable-next-line no-use-before-define
        devServer.sockWrite(devServer.sockets, 'errors', errors),
    };

    // Create a webpack compiler that is configured with custom messages.
    const compiler = await createCompiler({
      appName,
      config,
      devSocket,
      urls,
      useTypeScript,
      progress,
    });

    const { proxy } = devServerConfig;
    // Serve webpack assets generated by the compiler over a web server.
    const serverConfig = {
      disableHostCheck: !proxy,
      compress: true,
      clientLogLevel: 'none',
      watchContentBase: true,
      hot: true,
      // WDS still outputs the status when quiet is true so we settle for noInfo (for now)
      noInfo: true,
      publicPath: (config.output && config.output.publicPath) || '/',
      historyApiFallback: true,
      stats: {
        all: false,
        errors: true,
        moduleTrace: true,
        warnings: true,
      },
      before(app) {
        // This service worker file is effectively a 'no-op' that will reset any
        // previous service worker registered for the same host:port combination.
        // We do this in development to avoid hitting the production cache if
        // it used the same host and port.
        // https://github.com/facebook/create-react-app/issues/2272#issuecomment-302832432
        app.use(noopServiceWorkerMiddleware('/'));
      },
      ...config.devServer,
    };

    const devServer = new WebpackDevServer(
      compiler,
      serverConfig,
      log({
        name: '4c/start',
        level: 'silent',
      }),
    );

    return new Promise((resolve, reject) => {
      devServer.listen(port, HOST, (err) => {
        if (err) {
          error(err);
          reject(err);
          return;
        }

        if (progress && isTTY) {
          clearConsole();
        }
      });

      const exit = () => {
        devServer.close();
        process.exit();
      };

      process.on('SIGINT', exit).on('SIGTERM', exit);
      resolve(devServer);
    });
  } catch (err) {
    if (err && err.message) {
      error(err);
    }
    throw err;
  }
};
