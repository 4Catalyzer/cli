const path = require('path');
const { promises: fs } = require('fs');
const { debuglog } = require('util');

const {
  spinner,
  chalk,
  stripAnsi,
  table,
} = require('@4c/cli-core/ConsoleUtilities');
const ArgUtilities = require('@4c/cli-core/ArgUtilities');

const sortImports = require('./sort-imports');
const runPrettier = require('./prettier');
const Linter = require('./Linter');

const debug = debuglog('pedantic');

/**
 * possible combinations are:
 *  - fix: fix errors, don't report non-fixable errors
 *  - fix & check: fix anything that's fixable and report non-fixable errors
 *  - check: report fixable and non-fixable errors
 */
module.exports = async (
  filePatterns,
  { cwd = process.cwd(), ignorePath, ignoreNodeModules, fix, check },
) => {
  debug('patterns:', filePatterns, 'fix:', fix, 'cwd', cwd);
  const progress = spinner('Checking formatting…');
  const linter = new Linter({ cwd, fix, check });

  const filePaths = await ArgUtilities.resolveFilePatterns(filePatterns, {
    cwd,
    ignoreNodeModules,
    absolute: true,
  });

  if (!filePaths.length) {
    process.exitCode = 1;
    progress.fail(
      "The provided file patterns didn't match any files: ",
      filePatterns.join(', '),
    );
  }

  let numDifferent = 0;
  const needsFormatting = [];

  try {
    await Promise.all(
      filePaths.map(async filePath => {
        let content;
        let code;

        // Prettier has the largest pool of files it can format so if
        // it can't parse it assume nothing else can and move on
        const canParse = await runPrettier.canParse(filePath);
        if (!canParse) {
          return;
        }

        try {
          content = await fs.readFile(filePath, 'utf8');

          code = sortImports(content, filePath);

          code = await runPrettier(code, filePath, ignorePath);

          if (code !== content) needsFormatting.push(filePath);

          code = linter.check(code, filePath);
        } catch (err) {
          // Don't exit the process if one file failed
          process.exitCode = 2;
          console.error(err, filePath);
          return;
        }

        if (content === code) {
          return;
        }

        numDifferent++;

        progress.text = chalk.dim(path.relative(cwd, filePath));

        if (fix) {
          await fs.writeFile(filePath, code, 'utf8');
        } else if (!check) {
          process.stdout.write(code);
        }
      }),
    );
  } catch (err) {
    progress.stop();
    throw err;
  }

  if (!numDifferent && !linter.hasChanges) {
    progress.succeed(
      `All ${
        filePaths.length
      } of matched files are properly formatted and linted`,
    );

    return;
  }

  const files = `file${numDifferent === 1 ? '' : 's'}`;
  progress.stop();

  if (!check) {
    if (fix) {
      progress.succeed(
        `Code style issues fixed in ${numDifferent} of ${
          filePaths.length
        } ${files} checked.`,
      );
    }
    return;
  }

  process.exitCode = 1;

  console.log(linter.output());

  if (!fix) {
    let output = '\n';
    output += `${table(
      needsFormatting.map(filePath => [
        '',
        path.relative(cwd, filePath).trim(),
      ]),
      {
        align: ['', 'l'],
        stringLength: str => stripAnsi(str).length,
      },
    )}

  `;

    output += chalk.red.bold(
      `\u2716 ${needsFormatting.length} Formatting issues`,
    );
    console.log(output);
  }
};
