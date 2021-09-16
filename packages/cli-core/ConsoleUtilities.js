import { debuglog } from 'util';

import chalk from 'chalk';
import _isCI from 'is-ci';
import symbols from 'log-symbols';
import ora from 'ora';
import stripAnsi from 'strip-ansi';
import table from 'text-table';

export { symbols, chalk, stripAnsi, table, debuglog as debug };

export const isCI = () => _isCI;

export function isTTY() {
  return process.stdout.isTTY && !_isCI;
}

export const spinner = (text) => ora(text).start();

export async function step(text, fn, skip) {
  const s = spinner(text);

  if (skip) {
    s.warn(`Skipping: ${text}`);
    return;
  }

  try {
    await fn(s);
    s.succeed();
  } catch (err) {
    s.fail(err.message);
    throw err;
  }
}

export const info = (msg) => {
  console.log(chalk.blue(`${symbols.info}  ${msg}`));
};

export const warn = (msg) => {
  console.log(chalk.yellow(`${symbols.warning}  ${msg}`));
};

export const error = (msg) => {
  console.log(chalk.red(`${symbols.error}  ${msg}`));
};

export const success = (msg) => {
  console.log(chalk.green(`${symbols.success}  ${msg}`));
};
