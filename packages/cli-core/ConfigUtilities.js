const readPkgUp = require('read-pkg-up');
const { readFileSync } = require('fs');
const commentJson = require('comment-json');
const getWorkspaces = require('get-workspaces').default;
const findWorkspacesRoot = require('find-workspaces-root').default;

const safeRequire = m => {
  try {
    return commentJson.parse(readFileSync(m, 'utf-8'));
  } catch {
    return null;
  }
};

const readPackageJson = readPkgUp;

const getPackageConfig = async (key, { cwd } = {}) => {
  const result = await readPackageJson({ cwd });

  if (!result) return null;
  return result.packageJson[key] || null;
};

const getTSConfig = (dir = process.cwd()) => {
  return safeRequire(`${dir}/tsconfig.json`);
};

const getLernaConfig = dir => {
  return safeRequire(`${dir}/lerna.json`);
};

module.exports = {
  readPackageJson,
  commentJson,
  getTSConfig,
  getLernaConfig,
  getPackageConfig,
  getWorkspaces,
  findWorkspacesRoot,
};
