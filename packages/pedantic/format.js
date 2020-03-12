const format = require('./lib');

exports.command = '$0 <patterns..>';

exports.describe = 'Format files';

exports.builder = _ =>
  _.option('write', {
    type: 'boolean',
    default: true,
    describe: 'Write fixed files to disk',
  })
    .option('prettier-ignore', {
      type: 'string',
      default: '.prettierignore',
      describe: 'The prettier ignore file',
    })
    .option('with-node-modules', {
      type: 'boolean',
      default: false,
      describe:
        'By default node_modules is ignored, to opt out of this behavior pass this flag',
    });

exports.handler = async argv => {
  const { _, patterns, write, withNodeModules, ...options } = argv;

  await format(patterns, {
    fix: write,
    check: false,
    ignoreNodeModules: !withNodeModules,
    ...options,
  });
};
