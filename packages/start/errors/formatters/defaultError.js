import upperFirst from 'lodash/upperFirst.js';

import { formatTitle } from '../webpackErrors.js';

function displayError(severity, error) {
  const baseError = formatTitle(severity, upperFirst(severity));

  if (!error.message) {
    return `${baseError}\n\n${error.webpackError}`;
  }

  return [
    `${baseError} ${error.file ? `in ${error.file.split('!').pop()}` : ''}`,
    '',
    error.message,
    '',
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

export default format;
