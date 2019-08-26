const ora = require('ora');
const isCI = require('is-ci');
const chalk = require('chalk');
const { debuglog } = require('util');
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

Object.assign(exports, {
  debug: debuglog,

  info: msg => {
    console.log(chalk.blue(`${symbols.info}  ${msg}`));
  },

  warn: msg => {
    console.log(chalk.yellow(`${symbols.warning}  ${msg}`));
  },

  error: msg => {
    console.log(chalk.red(`${symbols.error}  ${msg}`));
  },

  success: msg => {
    console.log(chalk.green(`${symbols.success}  ${msg}`));
  },
});
