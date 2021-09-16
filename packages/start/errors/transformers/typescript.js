const typescriptTransformer = (error) => {
  const { webpackError } = error;

  return webpackError && webpackError.origin === 'typescript'
    ? {
        ...error,
        ...webpackError,
        type: 'typescript',
        severity: 1000,
      }
    : error;
};

export default typescriptTransformer;
