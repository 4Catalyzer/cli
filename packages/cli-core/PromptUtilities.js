import inquirer from 'inquirer';

export function prompt(questions) {
  return inquirer.prompt(questions);
}

export function confirm(message) {
  return prompt([
    {
      type: 'expand',
      name: 'confirm',
      message,
      default: 2, // default to help in order to avoid clicking straight through
      choices: [
        { key: 'y', name: 'Yes', value: true },
        { key: 'n', name: 'No', value: false },
      ],
    },
  ]).then((answers) => answers.confirm);
}
export function select(message, { choices, filter, validate } = {}) {
  return prompt([
    {
      type: 'list',
      name: 'prompt',
      message,
      choices,
      pageSize: choices.length,
      filter,
      validate,
    },
  ]).then((answers) => answers.prompt);
}
export function input(message, { filter, validate } = {}) {
  return prompt([
    {
      type: 'input',
      name: 'input',
      message,
      filter,
      validate,
    },
  ]).then((answers) => answers.input);
}
