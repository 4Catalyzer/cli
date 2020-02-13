const { chalk } = require('@4c/cli-core/ConsoleUtilities');
const {
  formatTitle,
} = require('friendly-errors-webpack-plugin/src/utils/colors');

const numToShow = 50;
function formatFiles(files) {
  const remaining = files.length - numToShow;
  const subset = files.slice(0, numToShow);

  if (remaining < 10) {
    return files.join('\n');
  }

  return `${subset.join('\n')}\n... ${chalk.bold(`${remaining} more files`)}`;
}

module.exports = (allErrors, severity) => {
  const errors = allErrors.filter(e => e.type === 'unused-files');

  if (errors.length === 0) {
    return [];
  }

  function formatError({ unusedFiles }) {
    const total = unusedFiles.length;
    const files = total === 1 ? 'file' : 'files';

    return `${formatTitle(
      severity,
      'Unused Files',
    )} Found ${total} unused ${files}\n\n${formatFiles(unusedFiles)}`;
  }

  return errors.map(formatError);
};
