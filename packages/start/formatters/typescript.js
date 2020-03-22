const { chalk } = require('@4c/cli-core/ConsoleUtilities');
const { codeFrameColumns } = require('@babel/code-frame');
const exists = require('exists-case');
const {
  NormalizedMessage,
} = require('fork-ts-checker-webpack-plugin/lib/NormalizedMessage');
const {
  formatTitle,
} = require('friendly-errors-webpack-plugin/src/utils/colors');

function formatCaseError({ content, severity, code }) {
  const rFiles = /(?:'|")(.+?)(?:'|")/gm;
  const files = [];

  let match;
  // eslint-disable-next-line no-cond-assign
  while ((match = rFiles.exec(content))) {
    if (match) files.push(match[1]);
  }

  const fileOnDisk = files.find((file) => exists.sync(file));

  let formatted = `${formatTitle(
    severity,
    `TS${code}`,
  )} Mismatched file name cases`;

  if (fileOnDisk) {
    const otherFile = files.find((f) => f !== fileOnDisk);

    let diff = '';
    for (let i = 0; i < otherFile.length; i++) {
      const char = otherFile[i];
      diff +=
        char === fileOnDisk[i] ? chalk.bold(char) : chalk.bold.inverse(char);
    }

    formatted +=
      `\n\nA project file is importing:\n  ${diff}\n\n` +
      `But the file case on disk is:\n  ${chalk.bold(fileOnDisk)}\n\n` +
      `Cases of imported files should match the file system exactly`;
  } else {
    formatted += `\n\n${content}`;
  }

  return formatted;
}

function formatError(err, fs) {
  const {
    code,
    severity,
    file,
    content,
    stack,
    line,
    character: column,
  } = err;
  let fileRef = file && `in ${file}`;
  if (line && column) fileRef += `(${line},${column})`;

  if (code === 1149) {
    return formatCaseError(err);
  }

  if (code === NormalizedMessage.ERROR_CODE_INTERNAL) {
    return (
      `${formatTitle(severity, 'INTERNAL')} ${fileRef}\n` +
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
    `${formatTitle(severity, `TS${code}`)} ${fileRef}` +
    `\n\n${content}${frame ? `\n\n${frame}` : ''}`
  );
}

module.exports = (compiler) => {
  const fs = compiler.inputFileSystem;

  function formatErrors(allErrors) {
    const errors = allErrors
      .filter((e) => e.type === 'typescript')
      .map((e) => e.message);

    if (errors.length === 0) {
      return [];
    }

    const formatted = errors.map((err) => formatError(err, fs));

    return formatted;
  }

  return formatErrors;
};

module.exports.formatError = formatError;
