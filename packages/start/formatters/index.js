const moduleNotFound = require('./moduleNotFound');
const typescript = require('./typescript');
const unusedFiles = require('./unusedFiles');
const defaultError = require('./defaultError');

module.exports = compiler => [
  unusedFiles,
  typescript(compiler),
  moduleNotFound,
  require('friendly-errors-webpack-plugin/src/formatters/eslintError'),
  defaultError,
];
