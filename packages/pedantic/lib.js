const path = require('path');
const chalk = require('chalk');
const { promises: fs } = require('fs');
const { default: sortImports } = require('import-sort');
const { debuglog } = require('util');
const prettier = require('prettier');
const { getConfig } = require('import-sort-config');

const ConsoleUtilities = require('@4c/cli-core/ConsoleUtilities');
const ArgUtilities = require('@4c/cli-core/ArgUtilities');

const debug = debuglog('pedantic');

function sortFileImports(content, filePath) {
  const resolvedConfig = getConfig(
    path.extname(filePath),
    path.dirname(filePath),
  );

  if (!resolvedConfig || !resolvedConfig.parser || !resolvedConfig.style) {
    debug('could not resolve import sort config for:', filePath);
    return { code: content, changes: [] };
  }

  const { parser, style, options } = resolvedConfig;
  const result = sortImports(content, parser, style, filePath, options);

  return result.code;
}

async function runPrettier(content, filePath, ignorePath) {
  const { ignored } = await prettier.getFileInfo(filePath, { ignorePath });
  if (ignored) return content;
  const options = await prettier.resolveConfig(filePath);

  return prettier.format(content, { filepath: filePath, ...options });
}

module.exports = async (
  filePatterns,
  {
    cwd = process.cwd(),
    ignorePath,
    ignoreNodeModules,
    write,
    check,
    listDifferent,
  },
) => {
  const different = [];
  debug('patterns:', filePatterns, 'write:', write, 'cwd', cwd);
  console.log('Checking formatting…');

  const filePaths = await ArgUtilities.resolveFilePatterns(filePatterns, {
    ignoreNodeModules,
    cwd,
  });

  let spinner;
  if (ConsoleUtilities.isTTY()) {
    spinner = ConsoleUtilities.spinner();
  }

  if (!filePaths.length) {
    process.exitCode = 1;
    if (spinner) spinner.fail();
    console.error(
      "The provided file patterns didn't match any files: ",
      filePatterns.join(', '),
    );
  }

  await Promise.all(
    filePaths.map(async filePath => {
      let content;
      let code;

      try {
        content = await fs.readFile(filePath, 'utf8');

        code = sortFileImports(content, filePath);
        code = await runPrettier(code, filePath, ignorePath);
      } catch (err) {
        // Don't exit the process if one file failed
        process.exitCode = 2;
        console.error(err, filePath);
        return;
      }

      if (content === code) return;

      if (spinner) {
        spinner.text = path.relative(cwd, filePath);
      }

      if (write) {
        await fs.writeFile(filePath, code, 'utf8');
      }
      if (check || listDifferent) {
        different.push(filePath);
      }
    }),
  );

  if (different.length) {
    process.exitCode = 1;

    if (spinner) spinner.stop();

    different.forEach(f => console.log(`  -> ${chalk.dim(f)}`));

    if (spinner) {
      if (write) {
        spinner.succeed('Code style issues fixed in the above file(s).');
      } else if (check || listDifferent) {
        spinner.fail('Code style issues found in the above file(s).');
      }
    }
  } else if (spinner) {
    spinner.succeed('All matched files are properly formatted');
  }
};
