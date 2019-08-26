const readPkgUp = require('read-pkg-up');

const readPackageJson = readPkgUp;

const getPackageConfig = async (key, { cwd } = {}) => {
  const result = await readPackageJson({ cwd });

  if (!result) return null;
  return result.package[key] || null;
};

module.exports = { readPackageJson, getPackageConfig };
