const format = require('./lib');

exports.command = 'lint <patterns..>';

exports.describe = 'Lint files use ESLint, Prettier and import-sort';

exports.builder = _ =>
  _.option('fix', {
    type: 'boolean',
    default: false,
    describe: 'Automatically fix any fixable errors',
  }).option('with-node-modules', {
    type: 'boolean',
    default: false,
    describe:
      'By default node_modules is ignored, to opt out of this behavior pass this flag',
  });

exports.handler = async argv => {
  const { _, patterns, fix, withNodeModules, ...options } = argv;

  await format(patterns, {
    fix,
    check: true,
    ignoreNodeModules: !withNodeModules,
    ...options,
  });
};
