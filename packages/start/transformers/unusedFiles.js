const get = require('lodash/get');

module.exports = (error) => {
  const message = error.message || get(error, 'webpackError');
  if (
    typeof message === 'string' &&
    message.startsWith('\nUnusedFilesWebpackPlugin')
  ) {
    return {
      ...error,
      type: 'unused-files',
      unusedFiles: message
        .replace('UnusedFilesWebpackPlugin found some unused files:', '')
        .trim()
        .split(/\n/)
        .filter(Boolean),
    };
  }

  return error;
};
