const path = require('path');
const fs = require('fs-extra');
const execa = require('execa');
const inquirer = require('inquirer');
const GitUtilities = require('../GitUtilities');

const templatePath = path.resolve(__dirname, '../templates');

async function setupNpm(dest, a) {
  const eslint = {
    eslint: '^4.16.0',
    'eslint-config-prettier': '^2.9.0',
    'eslint-plugin-import': '^2.8.0',
    'eslint-plugin-prettier': '^2.5.0',
    'eslint-plugin-jest': '^21.7.0',
  };

  if (a.type === 'web') {
    eslint['eslint-config-4catalyzer-react'] = '^0.4.1';
    eslint['eslint-plugin-react'] = '^7.5.1';
    eslint['eslint-plugin-jsx-a11y'] = '^6.0.3';
  } else {
    eslint['eslint-config-4catalyzer'] = '^0.4.1';
  }

  fs.writeJSON(
    path.join(dest, 'package.json'),
    {
      name: a.name,
      version: '1.0.0',
      main: a.babel ? 'lib/index.js' : 'index.js',
      ...(a.babel && {
        module: 'es/index.js',
      }),

      repository: {
        type: 'git',
        url: GitUtilities.remoteUrl(a.name),
      },
      author: '4Catalyzer',
      license: 'MIT',
      scripts: {
        tdd: 'jest --watch',
        test: 'npm run lint && jest',
        testonly: 'jest',
        ...(a.babel && {
          'build:es':
            'babel src -d es --env-name esm --ignore **/__tests__ --delete-dir-on-start',
          'build:lib':
            'babel src -d lib --ignore **/__tests__ --delete-dir-on-start',
          build: 'npm run build:lib && npm run build:es',
          prepublishOnly: 'yarn run build',
        }),
        lint: [
          'eslint .',
          "prettier --list-different --ignore-path .eslintignore '**/*.{json,css,md}'",
        ].join(' && '),
        format: [
          'eslint . --fix',
          "prettier --write --ignore-path .eslintignore '**/*.{json,css,md}'",
        ].join(' && '),
        precommit: 'lint-staged',
      },
      publishConfig: {
        access: a.isPrivate ? 'restricted' : 'public',
      },
      prettier: {
        printWidth: 79,
        singleQuote: true,
        trailingComma: 'all',
      },
      'lint-staged': {
        '*.js': ['eslint --fix', 'git add'],
        '*.{json,css,md}': [
          'prettier --write --ignore-path .eslintignore',
          'git add',
        ],
      },
      jest: {
        roots: ['<rootDir>/test'],
        testEnvironment: a.type === 'node' ? 'node' : 'jsdom',
      },
      ...(a.semanticRelease && {
        release: {
          extends: ['@4c/semantic-release-config'],
        },
      }),
      devDependencies: {
        ...(a.babel && {
          '@babel/cli': '^7.0.0-beta.39',
          '@babel/core': '^7.0.0-beta.39',
          '@4c/babel-preset-4catalyzer': '^1.0.0',
          'babel-jest': '^22.4.3',
          'babel-core': 'bridge',
        }),
        ...(a.semanticRelease && {
          '@4c/semantic-release-config': '^1.0.2',
        }),
        'babel-eslint': '^8.2.1',
        husky: '^0.14.3',
        'lint-staged': '^7.1.0',
        prettier: '^1.10.2',
        jest: '^22.4.4',
        ...eslint,
      },
    },
    { spaces: 2 },
  );
}

module.exports = {
  command: 'new [location]',
  describe: 'create a new package',
  builder: _ =>
    _.positional('location', {
      type: 'string',
      default: process.cwd(),
      describe: 'the location of the package',
      normalize: true,
    }),

  async handler({ location }) {
    const dest = path.isAbsolute(location)
      ? location
      : path.resolve(process.cwd(), location);

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

    await GitUtilities.init(dest);
    await GitUtilities.addRemote(dest, answers.name);

    await setupNpm(dest, answers);

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
  },
};
