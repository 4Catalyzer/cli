const typescriptTransformer = (webpackError) => {
  const { message } = webpackError;

  return message && message.type
    ? {
        ...webpackError,
        message,
        type: 'typescript',
        severity: 1000,
      }
    : webpackError;
};

module.exports = typescriptTransformer;
