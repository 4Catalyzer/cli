const inquirer = require('inquirer');

exports.prompt = (questions) => inquirer.prompt(questions);

exports.confirm = (message) =>
  exports
    .prompt([
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
    ])
    .then((answers) => answers.confirm);
exports.select = (message, { choices, filter, validate } = {}) =>
  exports
    .prompt([
      {
        type: 'list',
        name: 'prompt',
        message,
        choices,
        pageSize: choices.length,
        filter,
        validate,
      },
    ])
    .then((answers) => answers.prompt);
exports.input = (message, { filter, validate } = {}) =>
  exports
    .prompt([
      {
        type: 'input',
        name: 'input',
        message,
        filter,
        validate,
      },
    ])
    .then((answers) => answers.input);
