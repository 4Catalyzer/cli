import format from './lib.js';

export const command = '$0 <patterns..>';

export const describe = 'Lint files using ESLint and Prettier';

export function builder(_) {
  return _.option('fix', {
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
}

export async function handler(argv) {
  const { _, patterns, fix, withWarnings, withNodeModules, ...options } = argv;

  await format(patterns, {
    fix,
    check: true,
    withWarnings,
    ignoreNodeModules: !withNodeModules,
    ...options,
  });
}
