const { chalk } = require('@4c/cli-core/ConsoleUtilities');

const {
  NormalizedMessage,
} = require('fork-ts-checker-webpack-plugin/lib/NormalizedMessage');
const {
  formatTitle,
} = require('friendly-errors-webpack-plugin/src/utils/colors');
const { codeFrameColumns } = require('@babel/code-frame');

function formatError(
  { code, severity, file, content, stack, line, character: column },
  fs,
) {
  if (code === NormalizedMessage.ERROR_CODE_INTERNAL) {
    return (
      `${formatTitle(severity, 'INTERNAL')} in ${file} ` +
      `(${line},${column})\n` +
      `${content}${stack ? `\nstack trace:\n${chalk.gray(stack)}` : ''}`
    );
  }

  let frame;
  let source = '';
  try {
    source = fs.readFileSync(file).toString();
  } catch {
    /* ignore */
  }

  if (source) {
    frame = codeFrameColumns(
      source,
      { start: { line, column } },
      { highlightCode: true },
    );
  }

  return (
    `${formatTitle(severity, `TS${code}`)} in ${file}(${line},${column})` +
    `\n\n${content}${frame ? `\n\n${frame}` : ''}`
  );
}

module.exports = compiler => {
  const fs = compiler.inputFileSystem;

  function formatErrors(allErrors) {
    const errors = allErrors
      .filter(e => e.type === 'typescript')
      .map(e => e.message);

    if (errors.length === 0) {
      return [];
    }

    const formatted = errors.map(err => formatError(err, fs));

    return formatted;
  }

  return formatErrors;
};

module.exports.formatError = formatError;
