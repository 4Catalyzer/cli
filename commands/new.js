const path = require('path');
const fs = require('fs-extra');
const execa = require('execa');
const inquirer = require('inquirer');
const GitUtilities = require('../GitUtilities');

const templatePath = path.resolve(__dirname, '../templates');
const repoName = name => name.replace(/^@4c\//, '');

async function setupNpm(dest, a) {
  const eslint = {
    eslint: '^4.16.0',
    'eslint-config-import': '^0.13.0',
    'eslint-config-prettier': '^2.9.0',
    'eslint-plugin-import': '^2.8.0',
    'eslint-plugin-prettier': '^2.5.0',
    'eslint-plugin-jest': '^21.7.0',
  };

  if (a.type === 'web') {
    eslint['eslint-config-4catalyzer-react'] = '^0.3.3';
    eslint['eslint-plugin-react'] = '^7.5.1';
    eslint['eslint-plugin-jsx-a11y'] = '^5.1.1';
  } else {
    eslint['eslint-config-4catalyzer'] = '^0.3.3';
  }

  fs.writeJSON(
    path.join(dest, 'package.json'),
    {
      name: a.name,
      version: '1.0.0',
      main: a.babel ? 'lib/index.js' : 'index.js',
      ...(a.babel && {
        modules: 'es/index.js',
        'jsnext:main': 'es/index.js',
      }),

      repository: `https://github.com/4Catalyzer/${repoName(a.name)}.git`,
      author: '4Catalyzer',
      license: 'MIT',
      scripts: {
        ...(a.babel && {
          'build:es': 'BABEL_ENV=esm babel src -d es --ignore __tests__',
          'build:lib': 'babel src -d lib --ignore __tests__',
          build: 'npm run build:lib && npm run build:es',
        }),
        lint: [
          'eslint .',
          "prettier --list-different --ignore-path .ignore '**/*.{json,css,md}'",
        ].join(' && '),
        format: [
          'eslint . --fix',
          "prettier --write --ignore-path .eslintignore '**/*.{json,css,md}'",
        ].join(' && '),
        precommit: 'lint-staged',
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
      devDependencies: {
        ...(a.babel && {
          '@babel/cli': '^7.0.0-beta.39',
          '@babel/core': '^7.0.0-beta.39',
          '@4c/babel-preset-4catalyzer': '^1.0.0',
        }),
        'babel-eslint': '^8.2.1',
        husky: '^0.14.3',
        'lint-staged': '^6.1.0',
        prettier: '^1.10.2',
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
        name: 'scope',
        type: 'input',
        message: 'package scope',
        default: '@4c',
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
    ]);

    if (answers.type === 'web') {
      answers.babel = true;
    }

    await fs.ensureDir(dest);

    await copyTemplate('gitignore', '.gitignore');
    await copyTemplate('.travis.yml');
    await copyTemplate('.eslintrc');
    await copyTemplate('.eslintignore');

    await GitUtilities.init(dest);
    await GitUtilities.addRemote(answers.name);

    await setupNpm(dest, answers);

    if (answers.babel) {
      await fs.ensureFile(path.join(dest, 'src/index.js'));
      await fs.writeFile(
        path.join(dest, '.babelrc.js'),
        `
module.exports = {
  presets: [
    [
      '@4c/4catalyzer',
      {
        target: '${answers.type}',
        modules: process.env.BABEL_ENV === 'esm' ? false : 'commonjs'
      },
    ],
  ]
};
      `,
      );
    } else {
      await fs.ensureFile(path.join(dest, 'index.js'));
    }

    await execa('yarn', ['install'], { cwd: dest, stdio: 'inherit' });

    await execa('npm', ['run', 'format'], { cwd: dest, stdio: 'inherit' });

    console.log('Done!');
  },
};
