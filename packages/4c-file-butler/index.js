#!/usr/bin/env node

const yargs = require('yargs');

const {
  createAltPublishDir,
  renameMjs,
  renameFlowTypes,
  renameFiles,
} = require('./lib');

const { argv: _1 } = yargs
  .command(
    'cp [src]',

    true,
    a =>
      a
        .positional('src', { type: 'string', default: 'src' })
        .option('rename', {
          type: 'string',
          describe:
            'Provide a file name pattern to rename against. interpolate values with [basename] and or [extname]',
        }),
    renameFiles,
  )
  .command(
    'flow [src]',
    true,
    a =>
      a.positional('src', {
        type: 'string',
        default: 'src',
      }),
    renameFlowTypes,
  )
  .command(
    'mjs [src]',
    false,
    a =>
      a.positional('src', {
        type: 'string',
        default: 'src',
      }),
    renameMjs,
  )
  .command('alt-publish-root', false, () => {}, createAltPublishDir)
  .option('pattern', {
    type: 'array',
    describe: 'A glob pattern to select files against the source directory',
    default: ['**/*.js', '!**/__tests__/**'],
    global: true,
  })
  .option('out-dir', {
    type: 'string',
    global: true,
    default: 'lib',
    describe: 'the output directory files are moved to',
  })
  .alias('out-dir', 'o')
  .help()
  .alias('help', 'h');
