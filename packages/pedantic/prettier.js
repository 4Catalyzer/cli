const prettier = require('prettier');

module.exports = async function runPrettier(
  content,
  filePath,
  ignorePath = '.prettierignore',
) {
  const { ignored, inferredParser } = await prettier.getFileInfo(filePath, {
    ignorePath,
  });
  if (ignored || !inferredParser) return content;
  const options = await prettier.resolveConfig(filePath);

  return prettier.format(content, { filepath: filePath, ...options });
};

module.exports.canParse = async filePath => {
  const { inferredParser } = await prettier.getFileInfo(filePath);
  return !!inferredParser;
};
