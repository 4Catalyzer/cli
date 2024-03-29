import { promises as fs } from 'fs';
import { relative } from 'path';
import { debuglog } from 'util';

import { resolveFilePatterns } from '@4c/cli-core/ArgUtilities';
import {
  chalk,
  spinner,
  stripAnsi,
  table,
} from '@4c/cli-core/ConsoleUtilities';

import FileFormatter from './FileFormatter.js';
import Linter from './Linter.js';

const debug = debuglog('pedantic');

/**
 * possible combinations are:
 *  - fix: fix errors, don't report non-fixable errors
 *  - fix & check: fix anything that's fixable and report non-fixable errors
 *  - check: report fixable and non-fixable errors
 */
export default async (
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

  const linter = new Linter({ cwd, fix });

  const filePaths = await resolveFilePatterns(filePatterns, {
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
      filePaths.map(async (filePath) => {
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

          code = await linter.check(code, filePath);
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

        progress.text = chalk.dim(relative(cwd, filePath));

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

  console.log(await linter.output());

  if (!fix && needsFormatting.length) {
    let output = '\n';
    output += `${table(
      needsFormatting.map((filePath) => ['', relative(cwd, filePath).trim()]),
      {
        align: ['', 'l'],
        stringLength: (str) => stripAnsi(str).length,
      },
    )}

  `;

    output += chalk.red.bold(
      `\u2716 ${needsFormatting.length} Formatting issues`,
    );
    console.log(output);
  }
};
