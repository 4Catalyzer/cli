const path = require('path');
const { default: importSort } = require('import-sort');
const { debuglog } = require('util');
const { getConfig } = require('import-sort-config');

const debug = debuglog('pedantic:import-sort');

const DEFAULT_SORT_CONFIGS = {
  '.js, .jsx, .mjs, .ts, .tsx': {
    parser: require.resolve('import-sort-parser-babylon'),
    style: require.resolve('@4c/import-sort/style'),
  },
};

module.exports = function sortImports(
  content,
  filePath,
  includeTypeDefs = false,
) {
  if (!includeTypeDefs && filePath.endsWith('.d.ts')) {
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
};
