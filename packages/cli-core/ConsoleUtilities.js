const ora = require('ora');
const execa = require('execa');
const { Transform } = require('stream');
const isCI = require('is-ci');

exports.isCI = () => isCI;

exports.isTTY = () => process.stdout.isTTY && !isCI;

exports.spinner = text => ora(text).start();

exports.step = async (text, fn, skip) => {
  const spinner = exports.spinner(text);
  const stream = new Transform({
    transform(chunk, encoding, callback) {
      callback(null, chunk);
    },
  });

  if (skip) {
    spinner.warn(`Skipping: ${text}`);
    return;
  }
  // const run = (cmd, args, options) => {
  //   execa
  // }

  try {
    const result = fn(spinner, stream);

    if (result[Symbol.asyncIterator] || result[Symbol.iterator]) {
      for await (const line of result) {
        spinner.text(line);
      }
    } else {
      await result;
    }
    spinner.succeed();
  } catch (err) {
    spinner.fail(err.message);
    throw err;
  }
};
