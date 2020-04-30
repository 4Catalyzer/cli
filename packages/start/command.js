const devServer = require('./lib');

exports.command = '$0';

exports.describe = 'Start a webpack app in development mode';

exports.builder = (_) =>
  _.option('config', {
    type: 'path',
    default: 'webpack.config.js',
  })
    .option('port', {
      type: 'number',
      alias: 'p',
    })
    .option('progress', {
      type: 'boolean',
      default: true,
      describe: 'Disable the progress bar',
    })
    .option('env-file', {
      type: 'path',
      describe: 'Provide a set of env variables via an env file',
    });

exports.handler = (args) => {
  return devServer(args).catch(() => {
    process.exit(1);
  });
};
