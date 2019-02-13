const ora = require('ora');
const isCI = require('is-ci');

exports.isCI = () => isCI;

exports.isTTY = () => process.stdout.isTTY && !isCI;

exports.spinner = text => ora(text).start();

exports.step = async (text, fn, skip) => {
  const spinner = exports.spinner(text);

  if (skip) {
    spinner.warn(`Skipping: ${text}`);
    return;
  }

  try {
    await fn(spinner);
    spinner.succeed();
  } catch (err) {
    spinner.fail(err.message);
    throw err;
  }
};
