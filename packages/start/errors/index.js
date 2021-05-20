const {
  formatText,
  formatTitle,
  formatErrors,
  transformErrors,
} = require('./webpackErrors');

function getMaxSeverityErrors(errors) {
  const maxSeverity = errors.reduce(
    (res, curr) => (curr.severity > res ? curr.severity : res),
    0,
  );

  return errors.filter((e) => e.severity === maxSeverity);
}

function printer(compiler) {
  const formatters = [
    require('./formatters/unusedFiles'),
    require('./formatters/moduleNotFound'),
    require('./formatters/relayCompiler'),
    require('./formatters/typescript')(compiler),
    require('./formatters/defaultError'),
  ];
  const transformers = [
    require('./transformers/moduleNotFound'),
    require('./transformers/typescript'),
    require('./transformers/relayCompiler'),
    require('./transformers/unusedFiles'),
  ];

  return (errors, severity) => {
    const topErrors = getMaxSeverityErrors(
      transformErrors(errors, transformers),
    );

    const subtitle =
      severity === 'error'
        ? `Failed to compile with ${topErrors.length} ${severity}s`
        : `Compiled with ${topErrors.length} ${severity}s`;

    console.log(`${formatText(severity, subtitle)}\n\n`);

    formatErrors(topErrors, formatters, severity).forEach((err) =>
      console.log(err),
    );
  };
}

module.exports = {
  printer,
  formatText,
  formatTitle,
  formatErrors,
};
