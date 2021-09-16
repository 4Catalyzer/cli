import format from './lib.js';

export const command = '$0 <patterns..>';

export const describe = 'Format files';

export function builder(_) {
  return _.option('write', {
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
}

export async function handler(argv) {
  const { _, patterns, write, withNodeModules, ...options } = argv;

  await format(patterns, {
    fix: write,
    check: false,
    ignoreNodeModules: !withNodeModules,
    ...options,
  });
}
