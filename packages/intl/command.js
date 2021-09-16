import { statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

import chalk from 'chalk';
import { sync } from 'glob';

const { red, green, yellow, blue } = chalk;

const formatters = {
  json: (msgs) => {
    const results = {};
    // removes debug info like start, file, etc
    for (const { id, description, defaultMessage } of Object.values(msgs)) {
      results[id] = {
        id,
        description,
        defaultMessage,
      };
    }
    return results;
  },

  smartling: (msgs) => {
    const results = {
      smartling: {
        translate_paths: [
          {
            path: '*/message',
            key: '{*}/message',
            instruction: '*/description',
          },
        ],
        variants_enabled: true,
        string_format: 'icu',
      },
    };
    for (const [id, msg] of Object.entries(msgs)) {
      results[id] = {
        message: msg.defaultMessage,
        description: msg.description,
      };
    }
    return results;
  },
};

function toPatterns(files) {
  return files.map((file) => {
    let pattern = join(process.cwd(), file);
    const stat = statSync(pattern);
    if (!stat || stat.isDirectory()) {
      pattern = join(pattern, './**/*.json');
    }
    return pattern;
  });
}

export const command = '$0 [paths..]';

export const describe =
  'Consolidate individual message.json files into a single locale';

export function builder(_) {
  return _.positional('paths', {
    type: 'string',
    describe: 'A glob selecting messages JSON files',
  })
    .option('out-dir', {
      alias: 'd',
      string: true,
    })
    .option('format', {
      alias: 'f',
      describe:
        'output messages in a specfic format for upload to translation service',
      choices: ['smartling'],
    });
}

export function handler({ paths, outDir, format = 'json' }) {
  const messages = {};
  const duplicates = new Map();

  let files = [];
  try {
    files = toPatterns([].concat(paths))
      .map((pattern) => sync(pattern))
      .reduce((arr, next) => [...arr, ...next], []);
  } catch (err) {
    /* ignore */
  }

  if (!files.length) {
    console.log(
      yellow(
        'No messages found in: \n' +
          `  ${paths.map((f) => join(process.cwd(), f)).join('\n  ')}`,
      ),
    );

    return;
  }

  files.forEach((filepath) => {
    let json = require(filepath);

    // An preprocessed messages json.
    if (!Array.isArray(json)) {
      json = Object.keys(json).map((k) => json[k]);
    }

    json.forEach((descriptor) => {
      const { id } = descriptor;
      // eslint-disable-next-line no-param-reassign
      descriptor.file = relative(process.cwd(), filepath);

      if (messages[id]) {
        const dup = duplicates.get(id);
        duplicates.set(
          id,
          dup ? [...dup, descriptor] : [messages[id], descriptor],
        );
        return;
      }
      messages[id] = descriptor;
    });
  });

  if (duplicates.size) {
    console.log(red(`  ${duplicates.size} duplicates found.`));

    duplicates.forEach((dups, id) => {
      console.log(`
  Duplicate message id: ${blue(id)} in the following files: ${dups
        .map(
          (d) => `
    - ${d.file}`,
        )
        .join('')}
    `);
    });

    process.exit(1);
  } else {
    console.log(green('No duplicate message ids, writing out messages file…'));
  }

  const result = formatters[format](messages);

  writeFileSync(
    join(process.cwd(), outDir, 'messages.en.json'),
    JSON.stringify(result),
    'utf8',
  );
}
