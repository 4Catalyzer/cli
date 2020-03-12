#!/usr/bin/env node

const { success } = require('@4c/cli-core/ConsoleUtilities');
const readPkgUp = require('read-pkg-up');
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
    'prepare-publish-dir [publish-dir]',
    true,
    _ =>
      _.positional('publish-dir', {
        type: 'string',
      }),
    async options => {
      let { publishDir } = options;
      if (!publishDir) {
        const result = await readPkgUp({ cwd: process.cwd });

        if (result) {
          const { release, publishConfig } = result.package;
          // lerna config and newer rollout
          if (publishConfig)
            publishDir = publishDir || publishConfig.directory;

          // The rollout or semantic release option
          if (release && !publishDir)
            publishDir = release.publishDir || release.pkgRoot;
        }
      }

      if (!publishDir) {
        throw new Error(
          'No publish directory specified and no local package config found with `publishConfig.directory` or `release.publishDir`',
        );
      }
      await createAltPublishDir({ publishDir });
      success('Done');
    },
  )
  .help()
  .alias('help', 'h')
  .parse(process.argv.slice(2));
