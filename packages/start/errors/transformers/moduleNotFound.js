const TYPE = 'module-not-found';

function transform(error) {
  if (error.message && error.message.includes('Module not found:')) {
    const [, module] = error.message.match(/Can't resolve '([^']+)'/) || [];

    // if there is no module it means that some webpack plugin threw an error
    // in a resolution hook
    if (module) {
      return {
        ...error,
        message: module ? `Module not found ${module}` : error.message,
        type: TYPE,
        severity: 900,
        module,
        name: 'Module not found',
      };
    }
  }

  return error;
}

module.exports = transform;
