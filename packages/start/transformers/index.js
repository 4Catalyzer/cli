const typescript = require('./typescript');
const unusedFiles = require('./unusedFiles');

module.exports = () => [
  unusedFiles,
  typescript,
  require('friendly-errors-webpack-plugin/src/transformers/babelSyntax'),
  require('friendly-errors-webpack-plugin/src/transformers/moduleNotFound'),
  require('friendly-errors-webpack-plugin/src/transformers/esLintError'),
];
