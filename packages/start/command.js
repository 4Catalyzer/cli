import devServer from './lib.js';

export const command = '$0';

export const describe = 'Start a webpack app in development mode';

export function builder(_) {
  return _.option('config', {
    type: 'path',
    default: 'webpack.config.js',
  })
    .option('port', {
      type: 'number',
      alias: 'p',
    })
    .option('progress', {
      type: 'boolean',
      default: true,
      describe: 'Disable the progress bar',
    })
    .option('typecheck', {
      type: 'boolean',
      default: true,
      describe: 'Enable typechecking for TypeScript projects',
    })
    .option('env-file', {
      type: 'path',
      describe: 'Provide a set of env variables via an env file',
    });
}

export function handler(args) {
  return devServer(args).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
