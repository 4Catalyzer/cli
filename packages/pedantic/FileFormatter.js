const prettier = require('prettier');
const path = require('path');
const { default: importSort } = require('import-sort');
const { debuglog } = require('util');
const { getConfig } = require('import-sort-config');

const debug = debuglog('pedantic:formatter');

const DEFAULT_SORT_CONFIGS = {
  '.js, .jsx, .mjs, .ts, .tsx': {
    parser: require.resolve('import-sort-parser-babylon'),
    style: require.resolve('@4c/import-sort/style'),
  },
};

class Formatter {
  constructor({ filePath, ignorePath }) {
    this.filePath = filePath;
    this.ignorePath = ignorePath || '.prettierignore';

    this.info = prettier.getFileInfo(filePath, { ignorePath });
    this.config = prettier.resolveConfig(filePath);
  }

  sortImports(content) {
    const { filePath } = this;
    if (filePath.endsWith('.d.ts')) {
      debug('Not attempting to sort imports in type def file:', filePath);
      return content;
    }

    const resolvedConfig = getConfig(
      path.extname(filePath),
      path.dirname(filePath),
      DEFAULT_SORT_CONFIGS,
    );

    if (!resolvedConfig || !resolvedConfig.parser || !resolvedConfig.style) {
      debug('could not resolve import sort config for:', filePath);
      return content;
    }

    const { parser, style, options } = resolvedConfig;
    const result = importSort(content, parser, style, filePath, options);

    return result.code;
  }

  async format(content) {
    const { filePath } = this;

    const [config, { ignored, inferredParser }] = await Promise.all([
      this.config,
      this.info,
    ]);

    if (ignored) return content;

    const sorted = this.sortImports(content, filePath);

    if (!inferredParser) return sorted;

    return prettier.format(sorted, { filepath: filePath, ...config });
  }

  async canParse() {
    return !!(await this.info).inferredParser;
  }
}

module.exports = Formatter;
