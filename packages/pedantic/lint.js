const format = require('./lib');

exports.command = 'lint <patterns..>';

exports.describe = 'Lint files use ESLint, Prettier and import-sort';

exports.builder = _ =>
  _.option('fix', {
    type: 'boolean',
    default: false,
    describe: 'Automatically fix any fixable errors',
  })
    .option('prettier-ignore', {
      type: 'string',
      default: '.prettierignore',
      describe: 'The prettier ignore file',
    })
    .option('with-warnings', {
      type: 'boolean',
      default: false,
      describe: 'Include warnings when triggering a nonzero exit code',
    })
    .option('with-node-modules', {
      type: 'boolean',
      default: false,
      describe:
        'By default node_modules is ignored, to opt out of this behavior pass this flag',
    });

exports.handler = async argv => {
  const { _, patterns, fix, withWarnings, withNodeModules, ...options } = argv;

  await format(patterns, {
    fix,
    check: true,
    withWarnings,
    ignoreNodeModules: !withNodeModules,
    ...options,
  });
};
