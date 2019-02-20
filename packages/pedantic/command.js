const format = require('./lib');

exports.command = '$0 <patterns..>';

exports.describe = 'Format files';

exports.builder = _ =>
  _.option('write', {
    type: 'boolean',
    default: true,
    describe: 'Format and write the files back to disk',
  })
    .option('check', {
      type: 'boolean',
      describe:
        'Checks if there are any files that need formatting and returns',
    })
    .option('with-node-modules', {
      type: 'boolean',
      default: false,
      describe:
        'By default node_modules is ignored, to opt out of this behavior pass this flag',
    });

exports.handler = async argv => {
  const { _, patterns, write, check, withNodeModules, ...options } = argv;

  await format(patterns, {
    write,
    check,
    ignoreNodeModules: !withNodeModules,
    ...options,
  });
};
