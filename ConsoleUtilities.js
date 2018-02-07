const ora = require('ora');

exports.spinner = text => ora(text).start();

exports.step = async (text, fn, skip) => {
  const spinner = exports.spinner(text);

  if (skip) {
    spinner.warn();
    return;
  }

  try {
    await fn();
    spinner.succeed();
  } catch (err) {
    spinner.fail(err.message);
  }
};
