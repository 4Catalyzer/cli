const ora = require('ora');
const isCI = require('is-ci');
const chalk = require('chalk');
const stripAnsi = require('strip-ansi');
const symbols = require('log-symbols');
const table = require('text-table');

exports.symbols = symbols;
exports.chalk = chalk;
exports.stripAnsi = stripAnsi;
exports.table = table;

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
