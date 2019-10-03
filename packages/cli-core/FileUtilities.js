const readPkgUp = require('read-pkg-up');

const readPackageJson = readPkgUp;

const getPackageConfig = async (key, { cwd } = {}) => {
  const result = await readPackageJson({ cwd });

  if (!result) return null;
  return result.packageJson[key] || null;
};

module.exports = { readPackageJson, getPackageConfig };
