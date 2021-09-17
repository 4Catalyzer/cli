const typescriptTransformer = (error) => {
  const { webpackError } = error;

  return webpackError && webpackError.origin === 'relay-compiler'
    ? {
        message: error.message,
        type: 'relay-compiler',
        severity: 1000,
      }
    : error;
};

export default typescriptTransformer;
