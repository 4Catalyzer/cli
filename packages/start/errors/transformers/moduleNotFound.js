const TYPE = 'module-not-found';

function transform(error) {
  if (error.message && error.message.includes('Module not found:')) {
    const [, module] = error.message.match(/Can't resolve '([^']+)'/);

    return {
      ...error,
      message: `Module not found ${module}`,
      type: TYPE,
      severity: 900,
      module,
      name: 'Module not found',
    };
  }

  return error;
}

module.exports = transform;
