const handler = require('./lib');

exports.command = '$0';

exports.describe = 'Start a webpack app in development mode';

exports.builder = _ =>
  _.option('config', {
    type: 'path',
    default: 'webpack.config.js',
  }).option('port', {
    type: 'number',
    alias: 'p',
  });

exports.handler = handler;
