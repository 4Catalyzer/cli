const format = require('./lib');

exports.command = '$0 <patterns..>';

exports.describe = 'Format files';

exports.builder = (_) =>
  _.option('write', {
    type: 'boolean',
    default: true,
    describe: 'Write fixed files to disk',
  })
    .option('check', {
      type: 'boolean',
      default: false,
      describe: 'Check for lint errors and report them',
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

exports.handler = async (argv) => {
  const { _, patterns, write, withNodeModules, check, ...options } = argv;

  await format(patterns, {
    fix: write,
    check,
    ignoreNodeModules: !withNodeModules,
    ...options,
  });
};
