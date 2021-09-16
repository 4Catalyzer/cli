import { chalk } from '@4c/cli-core/ConsoleUtilities';
import { codeFrameColumns } from '@babel/code-frame';
import { sync } from 'exists-case';

import { formatTitle } from '../webpackErrors.js';

function formatCaseError({ content, severity, code }) {
  const rFiles = /(?:'|")(.+?)(?:'|")/gm;
  const files = [];

  let match;
  // eslint-disable-next-line no-cond-assign
  while ((match = rFiles.exec(content))) {
    if (match) files.push(match[1]);
  }

  const fileOnDisk = files.find((file) => sync(file));

  let formatted = `${formatTitle(severity, code)} Mismatched file name cases`;

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

export function formatError(err, fs) {
  const { code, severity, message, file, location } = err;
  let fileRef = file && ` in ${file}`;
  const { line, column } = location ? location.start : {};
  if (line && column) fileRef += `(${line},${column})`;

  if (code === 'TS1149') {
    return formatCaseError(err);
  }

  let frame;
  if (location && file) {
    let source = '';
    try {
      source = fs.readFileSync(file).toString();
      if (source) {
        frame = codeFrameColumns(source, location, { highlightCode: true });
      }
    } catch {
      /* ignore */
    }
  }

  return (
    `${formatTitle(severity, code)}${fileRef}` +
    `\n\n${message}${frame ? `\n\n${frame}` : ''}`
  );
}

export default (compiler) => {
  const fs = compiler.inputFileSystem;

  function formatErrors(allErrors) {
    const errors = allErrors
      .filter((e) => e.type === 'typescript')
      .map((e) => e.webpackError);

    if (errors.length === 0) {
      return [];
    }

    return errors.map((err) => formatError(err, fs));
  }

  return formatErrors;
};
