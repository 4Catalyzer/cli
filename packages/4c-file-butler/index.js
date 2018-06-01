#!/usr/bin/env node

const path = require('path');
const yargs = require('yargs');
const cpy = require('cpy');

const strReg = /\[\s*(\w+)\s*\]/g;
const interpolate = pattern => filename => {
  const extname = path.extname(filename);
  const params = {
    extname,
    basename: path.basename(filename, extname),
  };
  return pattern.replace(strReg, (_, key) => params[key]);
};

const flowRename = interpolate('[basename].flow[extname]');
const mjsRename = interpolate('[basename].mjs');

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
    ({ src, pattern, outDir, rename }) =>
      cpy(pattern, `../${outDir}`, {
        cwd: src,
        parents: true,
        rename(filename) {
          if (!rename) return filename;
          return interpolate(rename)(filename);
        },
      }),
  )
  .command(
    'flow [src]',
    true,
    a =>
      a.positional('src', {
        type: 'string',
        default: 'src',
      }),
    ({ src, pattern, outDir }) =>
      cpy(pattern, `../${outDir}`, {
        cwd: src,
        parents: true,
        rename: flowRename,
      }),
  )
  .command(
    'mjs [src]',
    false,
    a =>
      a.positional('src', {
        type: 'string',
        default: 'src',
      }),
    ({ src, pattern, outDir }) =>
      cpy(pattern, `../${outDir}`, {
        cwd: src,
        parents: true,
        rename: mjsRename,
      }),
  )
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
