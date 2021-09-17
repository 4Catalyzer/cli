/* eslint-disable no-param-reassign */
import chalk from 'chalk';
import listrInput from 'listr-input';
import rxjs from 'rxjs';
import catchError from 'rxjs/operators/catchError.js';

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

  return rxjs.throwError(error);
};

export default handleNpmError;
