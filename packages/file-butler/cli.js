#!/usr/bin/env node

const yargs = require('yargs');

const {
  createAltPublishDir,
  renameMjs,
  renameFlowTypes,
  renameFiles,
} = require('./lib');

yargs
  .command(
    'cp [src]',

    true,
    _ =>
      _.positional('src', {
        type: 'string',
        default: 'src',
      }).option('rename', {
        type: 'string',
        describe:
          'Provide a file name pattern to rename against. interpolate values with [basename] and or [extname]',
      }),
    renameFiles,
  )
  .command(
    'flow [src]',
    true,
    _ =>
      _.positional('src', {
        type: 'string',
        default: 'src',
      }),
    renameFlowTypes,
  )
  .command(
    'mjs [src]',
    false,
    _ =>
      _.positional('src', {
        type: 'string',
        default: 'src',
      }),
    renameMjs,
  )
  .command(
    'prepare-publish-dir',
    false,
    _ =>
      _.positional('publish-dir', {
        type: 'string',
        default: 'lib',
      }),
    createAltPublishDir,
  )
  .help()
  .alias('help', 'h');
