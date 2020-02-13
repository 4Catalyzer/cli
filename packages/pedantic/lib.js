const { promises: fs } = require('fs');
const path = require('path');
const { debuglog } = require('util');

const ArgUtilities = require('@4c/cli-core/ArgUtilities');
const {
  spinner,
  chalk,
  stripAnsi,
  table,
} = require('@4c/cli-core/ConsoleUtilities');

const FileFormatter = require('./FileFormatter');
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
  {
    cwd = process.cwd(),
    withWarnings,
    prettierIgnore,
    ignoreNodeModules,
    fix,
    check,
  },
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

        const formatter = new FileFormatter({
          filePath,
          ignorePath: prettierIgnore,
        });

        // Prettier has the largest pool of files it can format so if
        // it can't parse it assume nothing else can and move on
        if (!(await formatter.canParse())) {
          return;
        }

        try {
          content = await fs.readFile(filePath, 'utf8');

          code = await formatter.format(content);

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
  } finally {
    progress.stop();
  }

  const noUnfixedChanges = !linter.hasChanges && (numDifferent === 0 || fix);

  if (noUnfixedChanges || !check) {
    if (numDifferent === 0) {
      progress.succeed(
        `All ${filePaths.length} of matched files are properly formatted and linted`,
      );
    } else if (fix) {
      progress.succeed(
        `Code format and lint issues fixed in ${numDifferent} of ${filePaths.length} files checked.`,
      );
    }
    return;
  }

  if (
    numDifferent ||
    linter.errorCount ||
    (withWarnings && linter.warningCount)
  ) {
    process.exitCode = 1;
  }

  console.log(linter.output());

  if (!fix && needsFormatting.length) {
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
