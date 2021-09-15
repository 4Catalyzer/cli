import { isAbsolute, relative, resolve } from 'path';

import {
  isGitRepo as _isGitRepo,
  addRemote,
  getRemoteUrl,
  init,
  remoteUrl,
} from '@4c/cli-core/GitUtilities';
import findWorkspaceRoot from 'find-yarn-workspace-root';

import addHelpers from './addHelpers.js';
import {
  getPackageNameFromPath,
  runPrettier,
  sortJsonPath,
  templatePath,
} from './utils.js';

let $workspaceRoot;
const getRoot = (location) => {
  if (!$workspaceRoot) $workspaceRoot = findWorkspaceRoot(location);
  return $workspaceRoot;
};

const prompts = [
  {
    name: 'location',
    type: 'input',
    message: 'package location',
    filter: (location) =>
      isAbsolute(location) ? location : resolve(location),
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
    when: (_) => !!_.scopePackage,
  },
  {
    name: 'isPrivate',
    type: 'confirm',
    default: false,
    message: 'Is this a private package?',
    when: (_) => !getRoot(_.location) && !!_.scope,
  },
  {
    name: 'name',
    type: 'input',
    message: 'name',
    default: (_) => getPackageNameFromPath(_.scope, _.location),
  },
  {
    name: 'type',
    type: 'list',
    default: 'node',
    choices: ['node', 'web'],
    message: 'What type of library is this?',
  },
  {
    name: 'typescript',
    type: 'confirm',
    default: false,
    message: 'Do you want to use TypeScript?',
  },
  {
    name: 'babel',
    type: 'confirm',
    default: false,
    message: 'Do you need babel (maybe not?)',
    when: (_) => _.type === 'node' && !_.typescript,
  },
];

export default (plop) => {
  addHelpers(plop);

  // controller generator
  plop.setGenerator('new-package', {
    description: 'create a new package',
    prompts,
    actions(answers) {
      const { type, location, typescript } = answers;
      const workspaceRoot = getRoot(location);
      // mutate so templates have the correct value
      if (type === 'web' || typescript) answers.babel = true; // eslint-disable-line no-param-reassign
      const data = {
        workspaceRoot,
        workspaceLocation: workspaceRoot && relative(workspaceRoot, location),
        esm: answers.babel && type === 'web',
        includeEslint: !workspaceRoot && type === 'web',
      };

      return [
        async () => {
          data.gitRepo =
            (await getRemoteUrl(workspaceRoot)) || remoteUrl(answers.name);
        },
        {
          type: 'add',
          path: '{{location}}/package.json',
          templateFile: `${templatePath}/package.json.hbs`,
          data,
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
          path: `{{location}}/.github/workflows/ci.yml`,
          templateFile: `${templatePath}/ci.yml.hbs`,
          skipIfExists: true,
          data,
        },
        !workspaceRoot && {
          type: 'add',
          path: `{{location}}/.eslintrc.json`,
          templateFile: `${templatePath}/.eslintrc.hbs`,
          skipIfExists: true,
          data,
        },
        !workspaceRoot && {
          type: 'add',
          path: `{{location}}/.eslintignore`,
          templateFile: `${templatePath}/ignore`,
          skipIfExists: true,
          data,
        },
        !workspaceRoot && {
          type: 'add',
          path: `{{location}}/.prettierignore`,
          templateFile: `${templatePath}/ignore`,
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
        async (_) => {
          const isGitRepo = await _isGitRepo(location);
          if (isGitRepo) return;

          try {
            await init(location);
            await addRemote(location, _.name);
          } catch {
            /* ignore */
          }
        },
        answers.typescript && {
          type: 'add',
          path: `{{location}}/tsconfig.json`,
          templateFile: `${templatePath}/tsconfig.json.hbs`,
          skipIfExists: true,
          data,
        },
        answers.typescript &&
          workspaceRoot && {
            type: 'add',
            path: `{{location}}/tsconfig.build.json`,
            templateFile: `${templatePath}/tsconfig.build.json.hbs`,
            skipIfExists: true,
            data,
          },
        answers.babel && {
          type: 'add',
          path: `{{location}}/.babelrc.js`,
          templateFile: `${templatePath}/babelrc.js.hbs`,
          skipIfExists: true,
          data,
        },
        {
          type: 'add',
          path: `{{location}}/${answers.babel ? 'src/' : ''}index.${
            answers.typescript ? 'ts' : 'js'
          }`,
          templateFile: `${templatePath}/index.js.hbs`,
          skipIfExists: true,
          data,
        },
        // we run through prettier to remove any trailing commas
        // caused by templating combinations
        () => runPrettier('**/*.{js,json,md}', location),
        () =>
          sortJsonPath(`${location}/package.json`, [
            'dependencies',
            'devDependencies',
            'peerDependencies',
            'scripts',
          ]),

        !workspaceRoot &&
          (() => {
            console.log('Done! Run `yarn` to install dependencies.');
          }),
      ].filter(Boolean);
    },
  });
};
