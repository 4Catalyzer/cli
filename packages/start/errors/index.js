import {
  formatErrors,
  formatText,
  formatTitle,
  transformErrors,
} from './webpackErrors.js';

function getMaxSeverityErrors(errors) {
  const maxSeverity = errors.reduce(
    (res, curr) => (curr.severity > res ? curr.severity : res),
    0,
  );

  return errors.filter((e) => e.severity === maxSeverity);
}

async function printer(compiler) {
  const formatters = await Promise.all([
    import('./formatters/unusedFiles.js').then((m) => m.default),
    import('./formatters/moduleNotFound.js').then((m) => m.default),
    import('./formatters/relayCompiler.js').then((m) => m.default),
    import('./formatters/typescript.js').then((m) => m.default(compiler)),
    import('./formatters/defaultError.js').then((m) => m.default),
  ]);
  const transformers = await Promise.all([
    import('./transformers/moduleNotFound.js').then((m) => m.default),
    import('./transformers/typescript.js').then((m) => m.default),
    import('./transformers/relayCompiler.js').then((m) => m.default),
    import('./transformers/unusedFiles.js').then((m) => m.default),
  ]);

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

export { printer, formatText, formatTitle, formatErrors };
