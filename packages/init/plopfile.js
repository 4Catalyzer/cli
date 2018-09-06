const path = require('path');
const execa = require('execa');
const GitUtilities = require('@4c/cli-core/GitUtilities');

const addHelpers = require('./addHelpers');
const { getPackageNameFromPath, templatePath } = require('./utils');

const ignore = () => {};

const prompts = [
  {
    name: 'location',
    type: 'input',
    message: 'package location',
    filter: location =>
      path.isAbsolute(location) ? location : path.resolve(location),
  },
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
    default: _ => getPackageNameFromPath(_.scope, _.location),
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
];

module.exports = plop => {
  addHelpers(plop);

  plop.setHelper('gitUrl', name => GitUtilities.remoteUrl(name));

  // controller generator
  plop.setGenerator('new-package', {
    description: 'create a new package',
    prompts,
    actions({ type, babel, location }) {
      if (type === 'web') babel = true; // eslint-disable-line no-param-reassign

      return [
        {
          type: 'add',
          path: '{{location}}/package.json',
          templateFile: `${templatePath}/package.json.hbs`,
        },
        {
          type: 'add',
          path: '{{location}}/.gitignore',
          templateFile: `${templatePath}/gitignore`,
          skipIfExists: true,
        },
        {
          type: 'add',
          path: `{{location}}/.travis.yml`,
          templateFile: `${templatePath}/.travis.yml.hbs`,
          skipIfExists: true,
        },
        {
          type: 'add',
          path: `{{location}}/.eslintrc`,
          templateFile: `${templatePath}/.eslintrc.hbs`,
          skipIfExists: true,
        },
        {
          type: 'add',
          path: `{{location}}/.eslintignore`,
          templateFile: `${templatePath}/.eslintignore`,
          skipIfExists: true,
        },
        {
          type: 'add',
          path: `{{location}}/LICENSE`,
          templateFile: `${templatePath}/LICENSE.hbs`,
          skipIfExists: true,
        },
        () => GitUtilities.init(location).catch(ignore),
        _ => GitUtilities.addRemote(location, _.name).catch(ignore),
        babel
          ? {
              type: 'add',
              path: `{{location}}/.babelrc.js`,
              templateFile: `${templatePath}/babelrc.js.hbs`,
              skipIfExists: true,
            }
          : {
              type: 'add',
              path: `{{location}}/index.js`,
              skipIfExists: true,
            },
        () =>
          execa(
            'prettier',
            [
              `${location}/**/*.{js,json,md}`,
              `${location}/.eslintrc`,
              '--write',
            ],
            { cwd: location },
          ).catch(ignore),
        () => execa('yarn', ['install'], { cwd: location, stdio: 'inherit' }),
        () =>
          execa('yarn', ['upgrade-interactive', '--latest'], {
            cwd: location,
            stdio: 'inherit',
          }),

        ({ semanticRelease }) => {
          if (semanticRelease) {
            console.log(
              '\nRun `npx semantic-release-cli setup` after pushing to github for the first time to setup semantic release\n',
            );
          } else {
            console.log('Done!');
          }
        },
      ];
    },
  });
};
