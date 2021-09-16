/* eslint-disable no-param-reassign */
import { promises as fs } from 'fs';
import {
  extname as _extname,
  relative as _relative,
  basename,
  dirname,
  join,
  resolve,
} from 'path';

import { resolveFilePatterns } from '@4c/cli-core/ArgUtilities';
import {
  debug as _debug,
  error,
  success,
} from '@4c/cli-core/ConsoleUtilities';
import camelCase from 'lodash/camelCase.js';
import upperFirst from 'lodash/upperFirst.js';

import svg2c, { getConfig } from './lib.js';
import typeDef from './typeDef.js';

const debug = _debug('svg2c');

export const command = '$0 <patterns..>';

export const describe = 'Publish a new version';

export function builder(_) {
  return _.positional('patterns', {
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
}

export async function handler({
  patterns,
  outDir,
  baseDir,
  extensions,
  esModules,
  noTypes,
  config: extraConfig,
}) {
  const files = await resolveFilePatterns(patterns, {
    absolute: true,
  });

  if (!files.length) {
    error('The provided file patterns returned no files');
    process.exit(1);
  }

  const config = await getConfig(extraConfig);
  let count = 0;

  await Promise.all(
    files.map(async (file) => {
      const extname = _extname(file);
      if (!extensions.includes(extname)) return;

      count++;

      const src = await fs.readFile(file, 'utf8');

      const displayName = upperFirst(camelCase(basename(file, extname)));

      const base = baseDir ? resolve(baseDir) : dirname(file);
      const relative = dirname(_relative(base, file));

      const output = join(outDir, relative, `${displayName}.js`);
      const typeOut = join(outDir, relative, `${displayName}.d.ts`);

      debug(`${basename(file)} -> ${displayName}`);

      const code = await svg2c(src, {
        config,
        esModules,
        filename: file,
      });

      await fs.mkdir(dirname(output), { recursive: true });

      await Promise.all([
        fs.writeFile(output, code, 'utf8'),
        !noTypes && fs.writeFile(typeOut, typeDef, 'utf8'),
      ]);
    }),
  );

  success(`Successfully built ${count} svg components`);
}
