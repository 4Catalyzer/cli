const upperFirst = require('lodash/upperFirst');

const { formatTitle } = require('../webpackErrors');

function displayError(severity, error) {
  return [
    `${formatTitle(severity, upperFirst(severity))} Relay could not compile`,
    '',
    error.message,
    '',
  ];
}

/**
 * Format errors without a type
 */
function format(errors, type) {
  return errors
    .filter((e) => e.type === 'relay-compiler')
    .reduce((accum, error) => accum.concat(displayError(type, error)), []);
}

module.exports = format;
