import { chalk } from '@4c/cli-core/ConsoleUtilities';
import upperFirst from 'lodash/upperFirst.js';

function getFile(e) {
  if (e.file) {
    return e.file;
  }
  if (typeof e.moduleIdentifier === 'string') {
    return e.moduleIdentifier.split('!').pop();
  }
  return null;
}

function transformErrors(errors, transformers) {
  return errors.map((e) =>
    transformers.reduce((error, transformer) => transformer(error), {
      message: e.message,
      file: getFile(e),
      name: e.name,
      severity: 0,
      webpackError: e,
    }),
  );
}

function formatErrors(errors, formatters, errorType) {
  const format = (formatter) => formatter(errors, errorType) || [];
  const flatten = (accum, curr) => accum.concat(curr);

  return formatters.map(format).reduce(flatten, []);
}

function textColor(severity) {
  switch (severity.toLowerCase()) {
    case 'success':
      return 'green';
    case 'info':
      return 'blue';
    case 'note':
      return 'white';
    case 'warning':
      return 'yellow';
    case 'error':
      return 'red';
    default:
      return 'red';
  }
}

function formatTitle(severity, message) {
  const color = textColor(severity);
  return chalk[`bg${upperFirst(color)}`].black('', message, '');
}

function formatText(severity, message) {
  return chalk[textColor(severity)](message);
}

export { formatTitle, formatText, formatErrors, transformErrors };
