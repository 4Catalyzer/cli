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

const DEFAULT_SORT_CONFIGS = {
  '.js, .jsx, .mjs, .ts, .tsx': {
    parser: require.resolve('import-sort-parser-babylon'),
    style: require.resolve('@4c/import-sort/style'),
  },
};

function sortFileImports(content, filePath, includeTypeDefs = false) {
  const noChanges = { code: content, changes: [] };

  if (!includeTypeDefs && filePath.endsWith('.d.ts')) {
    debug('Not attempting to sort imports in type def file:', filePath);
    return noChanges;
  }

  const resolvedConfig = getConfig(
    path.extname(filePath),
    path.dirname(filePath),
    DEFAULT_SORT_CONFIGS,
  );

  if (!resolvedConfig || !resolvedConfig.parser || !resolvedConfig.style) {
    debug('could not resolve import sort config for:', filePath);
    return noChanges;
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
  { cwd = process.cwd(), ignorePath, ignoreNodeModules, write, check },
) => {
  debug('patterns:', filePatterns, 'write:', write, 'cwd', cwd);
  const spinner = ConsoleUtilities.spinner('Checking formatting…');

  const filePaths = await ArgUtilities.resolveFilePatterns(filePatterns, {
    ignoreNodeModules,
    cwd,
  });

  if (!filePaths.length) {
    process.exitCode = 1;
    spinner.fail(
      "The provided file patterns didn't match any files: ",
      filePatterns.join(', '),
    );
  }
  let numDifferent = 0;

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

      numDifferent++;

      if (check) {
        spinner.stopAndPersist(); // we don't want these to replace each other
        console.log(`  -> ${chalk.dim(filePath)}`);
      } else if (write) {
        spinner.text = chalk.dim(path.relative(cwd, filePath));
        await fs.writeFile(filePath, code, 'utf8');
      } else {
        spinner.stopAndPersist();
        process.stdout.write(code);
      }
    }),
  );

  if (!numDifferent) {
    spinner.succeed(
      `All ${filePaths.length} of matched files are properly formatted`,
    );
    return;
  }

  if (check) {
    process.exitCode = 1;
  }
  const files = `files${numDifferent === 1 ? '' : 's'}`;
  if (check) {
    spinner.fail(
      `Code style issues found in the above ${numDifferent} ${files}`,
    );
  } else if (write) {
    spinner.succeed(
      `Code style issues fixed in ${numDifferent} of ${
        filePaths.length
      } ${files} checked.`,
    );
  }
};
