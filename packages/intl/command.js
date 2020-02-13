const { writeFileSync, statSync } = require('fs');
const path = require('path');

const { red, green, yellow, blue } = require('chalk');
const glob = require('glob');

function toPatterns(files) {
  return files.map(file => {
    let pattern = path.join(process.cwd(), file);
    const stat = statSync(pattern);
    if (!stat || stat.isDirectory()) {
      pattern = path.join(pattern, './**/*.json');
    }
    return pattern;
  });
}

exports.command = '$0 [paths..]';

exports.describe =
  'Consolidate individual message.json files into a single locale';

exports.builder = _ =>
  _.positional('paths', {
    type: 'string',
    describe: 'A glob selecting messages JSON files',
  }).option('out-dir', {
    alias: 'd',
    string: true,
  });

exports.handler = ({ paths, outDir }) => {
  const messages = {};
  const duplicates = new Map();

  let files = [];
  try {
    files = toPatterns([].concat(paths))
      .map(pattern => glob.sync(pattern))
      .reduce((arr, next) => [...arr, ...next], []);
  } catch (err) {
    /* ignore */
  }

  if (!files.length) {
    console.log(
      yellow(
        'No messages found in: \n' +
          `  ${paths.map(f => path.join(process.cwd(), f)).join('\n  ')}`,
      ),
    );

    return;
  }

  files.forEach(filepath => {
    let json = require(filepath);

    // An preprocessed messages json.
    if (!Array.isArray(json)) {
      json = Object.keys(json).map(k => json[k]);
    }

    json.forEach(descriptor => {
      const { id } = descriptor;
      // eslint-disable-next-line no-param-reassign
      descriptor.file = path.relative(process.cwd(), filepath);

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
          d => `
    - ${d.file}`,
        )
        .join('')}
    `);
    });

    process.exit(1);
  } else {
    console.log(green('No duplicate message ids, writing out messages file…'));
  }

  Object.keys(messages).forEach(id => {
    delete messages[id].file;
    delete messages[id].start;
    delete messages[id].end;
  });

  writeFileSync(
    path.join(process.cwd(), outDir, 'messages.en.json'),
    JSON.stringify(messages),
    'utf8',
  );
};
