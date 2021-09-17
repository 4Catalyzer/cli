export default (error) => {
  const message = error.message || error.webpackError;
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
