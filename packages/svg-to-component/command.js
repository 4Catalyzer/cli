/* eslint-disable no-param-reassign */
const { promises: fs } = require('fs');
const path = require('path');

const ArgUtilities = require('@4c/cli-core/ArgUtilities');
const ConsoleUtilities = require('@4c/cli-core/ConsoleUtilities');
const camelCase = require('lodash/camelCase');
const upperFirst = require('lodash/upperFirst');

const svg2c = require('./lib');
const typeDef = require('./typeDef');

const debug = ConsoleUtilities.debug('svg2c');

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
    })
    .option('no-types', {
      type: 'boolean',
      describe: 'Disable the generation of typescript types',
    });

exports.handler = async ({
  patterns,
  outDir,
  baseDir,
  extensions,
  esModules,
  noTypes,
  config: extraConfig,
}) => {
  const files = await ArgUtilities.resolveFilePatterns(patterns, {
    absolute: true,
  });

  if (!files.length) {
    ConsoleUtilities.error('The provided file patterns returned no files');
    process.exit(1);
  }

  const config = await svg2c.getConfig(extraConfig);
  let count = 0;

  await Promise.all(
    files.map(async file => {
      const extname = path.extname(file);
      if (!extensions.includes(extname)) return;

      count++;

      const src = await fs.readFile(file, 'utf8');

      const displayName = upperFirst(camelCase(path.basename(file, extname)));

      const base = baseDir ? path.resolve(baseDir) : path.dirname(file);
      const relative = path.dirname(path.relative(base, file));

      const output = path.join(outDir, relative, `${displayName}.js`);
      const typeOut = path.join(outDir, relative, `${displayName}.d.ts`);

      debug(`${path.basename(file)} -> ${displayName}`);

      const code = await svg2c(src, {
        config,
        esModules,
        filename: file,
      });

      await fs.mkdir(path.dirname(output), { recursive: true });

      await Promise.all([
        fs.writeFile(output, code, 'utf8'),
        !noTypes && fs.writeFile(typeOut, typeDef, 'utf8'),
      ]);
    }),
  );

  ConsoleUtilities.success(`Successfully built ${count} svg components`);
};
