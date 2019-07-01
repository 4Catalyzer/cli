/* eslint-disable no-param-reassign */
const { promises: fs } = require('fs');
const path = require('path');
const camelCase = require('lodash/camelCase');
const upperFirst = require('lodash/upperFirst');
const ArgUtilities = require('@4c/cli-core/ArgUtilities');
const svg2c = require('./lib');

exports.command = '$0 <patterns..>';

exports.describe = 'Publish a new version';

exports.builder = _ =>
  _.positional('patterns', {
    type: 'array',
    describe: 'A directory or pattern resolving to svgs',
  })
    .option('out-dir', {
      alias: 'd',
      type: 'string',
      describe: 'The output directory',
    })
    .option('config', {
      type: 'string',
      describe:
        'An optional svgo config file path or json string for specifying additional conversion behavior',
    })
    .option('extensions', {
      alias: 'x',
      default: ['.svg'],
      describe: 'The extensions of files to compile',
    })
    .option('base-dir', {
      alias: 'b',
      type: 'string',
      describe:
        'The  starting point used to determine the relative path for output files ' +
        'Only useful for file glob patterns where the default base is the `dirname` ' +
        'of the resolved file. Specify to maintain nested directory structures in the `out-dir`',
    })
    .option('es-modules', {
      type: 'boolean',
      describe: 'Output ES modules instead of commonJs',
    });

exports.handler = async ({
  patterns,
  outDir,
  baseDir,
  extensions,
  esModules,
  config: extraConfig,
}) => {
  const files = await ArgUtilities.resolveFilePatterns(patterns, {
    absolute: true,
  });
  const config = await svg2c.getConfig(extraConfig);

  await Promise.all(
    files.map(async file => {
      const extname = path.extname(file);
      if (!extensions.includes(extname)) return;

      const src = await fs.readFile(file, 'utf8');

      const displayName = upperFirst(camelCase(path.basename(file, extname)));

      const base = baseDir ? path.resolve(baseDir) : path.dirname(file);
      const relative = path.dirname(path.relative(base, file));

      const output = path.join(outDir, relative, `${displayName}.js`);

      const code = await svg2c(src, {
        config,
        esModules,
        filename: file,
      });

      await fs.mkdir(path.dirname(output), { recursive: true });
      await fs.writeFile(output, code, 'utf8');
    }),
  );
};
