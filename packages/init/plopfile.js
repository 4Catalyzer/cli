const path = require('path');
const execa = require('execa');
const fs = require('fs');
const findWorkspaceRoot = require('find-yarn-workspace-root');
const GitUtilities = require('@4c/cli-core/GitUtilities');
const prettier = require('prettier');
const addHelpers = require('./addHelpers');
const { getPackageNameFromPath, templatePath } = require('./utils');

const ignore = () => {};

let $workspaceRoot;
const getRoot = location => {
  if (!$workspaceRoot) $workspaceRoot = findWorkspaceRoot(location);
  return $workspaceRoot;
};

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
    when: _ => !getRoot(_.location) && !!_.scope,
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
    when: _ => !getRoot(_.location),
  },
];

module.exports = plop => {
  addHelpers(plop);

  plop.setHelper('gitUrl', name => GitUtilities.remoteUrl(name));

  // controller generator
  plop.setGenerator('new-package', {
    description: 'create a new package',
    prompts,
    actions(answers) {
      const { type, location } = answers;
      const workspaceRoot = getRoot(location);
      // mutate so templates have the correct value
      if (type === 'web') answers.babel = true; // eslint-disable-line no-param-reassign
      const data = {
        workspaceRoot,
        includeEslint: !workspaceRoot && type === 'web',
      };

      return [
        {
          type: 'add',
          path: '{{location}}/_package.json',
          templateFile: `${templatePath}/package.json.hbs`,
          data,
        },
        // we run through prettier to remove any trailing commas. We have to
        // rename the file b/c otherwise prettier will try and parse the
        // pkg.json to read a config which fails bc of the trailing commas
        () => {
          fs.writeFileSync(
            `${location}/package.json`,
            prettier.format(
              fs.readFileSync(`${location}/_package.json`, 'utf8'),
              { parser: 'json-stringify' },
            ),
          );
          fs.unlinkSync(`${location}/_package.json`);
        },
        !workspaceRoot && {
          type: 'add',
          path: '{{location}}/.gitignore',
          templateFile: `${templatePath}/gitignore`,
          skipIfExists: true,
          data,
        },
        !workspaceRoot && {
          type: 'add',
          path: `{{location}}/.travis.yml`,
          templateFile: `${templatePath}/.travis.yml.hbs`,
          skipIfExists: true,
          data,
        },
        !workspaceRoot && {
          type: 'add',
          path: `{{location}}/.eslintrc`,
          templateFile: `${templatePath}/.eslintrc.hbs`,
          skipIfExists: true,
          data,
        },
        !workspaceRoot && {
          type: 'add',
          path: `{{location}}/.eslintignore`,
          templateFile: `${templatePath}/.eslintignore`,
          skipIfExists: true,
          data,
        },
        !workspaceRoot && {
          type: 'add',
          path: `{{location}}/LICENSE`,
          templateFile: `${templatePath}/LICENSE.hbs`,
          skipIfExists: true,
          data,
        },
        () => GitUtilities.init(location).catch(ignore),
        _ => GitUtilities.addRemote(location, _.name).catch(ignore),
        answers.babel
          ? {
              type: 'add',
              path: `{{location}}/.babelrc.js`,
              templateFile: `${templatePath}/babelrc.js.hbs`,
              skipIfExists: true,
              data,
            }
          : {
              type: 'add',
              path: `{{location}}/index.js`,
              templateFile: `${templatePath}/index.js.hbs`,
              skipIfExists: true,
              data,
            },
        () =>
          execa(
            'prettier',
            [
              `${location}/package.json`, // to fix any HBS trailing comma issues
              `'${location}/**/*.{js,json,md}'`,
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
        !workspaceRoot &&
          (({ semanticRelease }) => {
            if (semanticRelease) {
              console.log(
                '\nRun `npx semantic-release-cli setup` after pushing to github for the first time to setup semantic release\n',
              );
            } else {
              console.log('Done!');
            }
          }),
      ].filter(Boolean);
    },
  });
};
