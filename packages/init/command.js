const path = require('path');
const fs = require('fs-extra');
const execa = require('execa');
const inquirer = require('inquirer');
const GitUtilities = require('@4c/cli-core/GitUtilities');

const writePkgJson = require('./writePkgJson');

const templatePath = path.resolve(__dirname, './templates');

exports.command = '$0 [location]';

exports.describe = 'create a new package';

exports.builder = _ =>
  _.positional('location', {
    type: 'string',
    default: process.cwd(),
    describe: 'the location of the package',
    normalize: true,
  });

exports.handler = async ({ location, cwd = process.cwd() }) => {
  const dest = path.isAbsolute(location)
    ? location
    : path.resolve(cwd, location);

  const copyTemplate = (src, destName = src) =>
    fs.copyFile(path.join(templatePath, src), path.join(dest, destName));

  // my own convention of naming scoped repo's like 4c-foo on disk
  const getName = ({ scope }) => {
    let name = path.basename(dest);

    if (!scope) return name;
    name = name.replace(new RegExp(`^${scope.slice(1)}-`), '');
    return `${scope}/${name}`;
  };

  const answers = await inquirer.prompt([
    {
      name: 'scopePackage',
      type: 'confirm',
      message: 'Create a scoped package?',
      default: true,
    },
    {
      name: 'scope',
      type: 'input',
      message: 'package scope',
      default: '@4c',
      when: _ => !!_.scopePackage,
    },
    {
      name: 'isPrivate',
      type: 'confirm',
      default: false,
      message: 'Is this a private package?',
      when: _ => !!_.scope,
    },
    {
      name: 'name',
      type: 'input',
      message: 'name',
      default: getName,
    },
    {
      name: 'type',
      type: 'list',
      default: 'node',
      choices: ['node', 'web'],
      message: 'What type of library is this?',
    },
    {
      name: 'babel',
      type: 'confirm',
      default: false,
      message: 'Do you need babel (maybe not?)',
      when: _ => _.type === 'node',
    },
    {
      name: 'semanticRelease',
      type: 'confirm',
      default: true,
      message: 'Do you want to use semantic-release to handle releases?',
    },
  ]);

  if (answers.type === 'web') {
    answers.babel = true;
  }

  await fs.ensureDir(dest);

  await copyTemplate('gitignore', '.gitignore');
  await copyTemplate('.travis.yml');
  await copyTemplate(`${answers.type}.eslintrc`, '.eslintrc');
  await copyTemplate('.eslintignore');
  await copyTemplate('LICENSE');

  await GitUtilities.init(dest);
  await GitUtilities.addRemote(dest, answers.name);

  await writePkgJson(dest, answers);

  if (answers.babel) {
    await fs.ensureFile(path.join(dest, 'src/index.js'));
    await fs.writeFile(
      path.join(dest, '.babelrc.js'),
      `
module.exports = api => ({
  presets: [
    [
      '@4c/4catalyzer',
      {
        target: '${answers.type}',
        modules: api.env() === 'esm' ? false : 'commonjs'
      },
    ],
  ]
});
      `,
    );
  } else {
    await fs.ensureFile(path.join(dest, 'index.js'));
  }

  await execa('yarn', ['install'], { cwd: dest, stdio: 'inherit' });
  await execa('yarn', ['upgrade-interactive', '--latest'], {
    cwd: dest,
    stdio: 'inherit',
  });

  if (answers.semanticRelease) {
    console.log(
      '\nRun `npx semantic-release-cli setup` after pushing to github for the first time to setup semantic release\n',
    );
  } else {
    console.log('Done!');
  }
};
