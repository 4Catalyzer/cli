const typescriptTransformer = (error) => {
  const { webpackError } = error;

  return webpackError && webpackError.origin === 'relay-compiler'
    ? {
        message: error,
        type: 'relay-compiler',
        severity: 1000,
      }
    : error;
};

module.exports = typescriptTransformer;
