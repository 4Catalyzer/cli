const {
  formatTitle,
} = require('friendly-errors-webpack-plugin/src/utils/colors');

function removeLoaders(file) {
  if (!file) {
    return '';
  }
  const split = file.split('!');
  const filePath = split[split.length - 1];
  return `in ${filePath}`;
}

function displayError(severity, error) {
  const baseError = formatTitle(severity, severity);

  if (!error.message) {
    return `${baseError}\n\n${error.webpackError}`;
  }

  return [
    `${baseError} ${removeLoaders(error.file)}`,
    '',
    error.message,
    error.origin ? error.origin : '',
    '',
    error.infos,
  ];
}

function isDefaultError(error) {
  return !error.type;
}

/**
 * Format errors without a type
 */
function format(errors, type) {
  return errors
    .filter(isDefaultError)
    .reduce((accum, error) => accum.concat(displayError(type, error)), []);
}

module.exports = format;
