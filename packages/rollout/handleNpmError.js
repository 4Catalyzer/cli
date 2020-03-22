/* eslint-disable no-param-reassign */
const chalk = require('chalk');
const listrInput = require('listr-input');
const { throwError } = require('rxjs');
const { catchError } = require('rxjs/operators');

const handleNpmError = (error, task, executor, prompt) => {
  if (
    (error.stderr &&
      (error.stderr.includes('OTP') ||
        error.stderr.includes('one-time pass'))) ||
    error.message.includes('user TTY')
  ) {
    const { title } = task;
    task.title = `${title} ${chalk.yellow('(waiting for input…)')}`;

    return listrInput(prompt || 'Enter OTP:', {
      done: (otp) => {
        task.title = title;
        return executor(otp);
      },
    }).pipe(
      catchError((err) =>
        handleNpmError(err, task, executor, 'OTP was incorrect, try again:'),
      ),
    );
  }

  return throwError(error);
};

module.exports = handleNpmError;
