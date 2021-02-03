const { chalk } = require('@4c/cli-core/ConsoleUtilities');

const { formatTitle } = require('../webpackErrors');

function formatModuleNotFound(allErrors) {
  const errors = allErrors.filter((e) => e.type === 'module-not-found');

  if (errors.length === 0) {
    return [];
  }

  const missing = new Map();

  errors.forEach((error) => {
    if (!missing.has(error.module)) {
      missing.set(error.module, []);
    }
    missing.get(error.module).push(error.file);
  });

  const title = (m) => `"${chalk.blue(m)}"`;

  const dependencies = Array.from(
    missing.entries(),
    ([missingModule, files]) =>
      files.length > 1
        ? [
            `${title(missingModule)}`,
            '',
            `imports in the follow files:`,
            ...files.map((f) => ` ${chalk.cyan(f)}`),
          ].join('\n')
        : `${title(missingModule)} in ${chalk.cyan(files[0])}`,
  );

  return [
    `${formatTitle('error', 'Error')} Module${
      dependencies.length > 1 ? 's' : ''
    } not found: could not resolve the following imports`,
    '',
    ...dependencies.map((s) => `  ${s}`),
  ];
}

module.exports = formatModuleNotFound;
