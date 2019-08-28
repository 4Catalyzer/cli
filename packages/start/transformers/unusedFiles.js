module.exports = error => {
  if (
    typeof error.message === 'string' &&
    error.message.startsWith('\nUnusedFilesWebpackPlugin')
  ) {
    return {
      ...error,
      type: 'unused-files',
      unusedFiles: error.message
        .replace('UnusedFilesWebpackPlugin found some unused files:', '')
        .split(/\n/)
        .filter(Boolean),
    };
  }

  return error;
};
