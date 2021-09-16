import {
  basename as _basename,
  extname as _extname,
  join,
  normalize,
} from 'path';

import cpy from 'cpy';
import { copyFile, outputJson, readJson } from 'fs-extra';
import globby from 'globby';

const strReg = /\[\s*(\w+)\s*\]/g;
const interpolate = (pattern) => (filename) => {
  const extname = _extname(filename);
  const params = {
    extname,
    basename: _basename(filename, extname),
  };
  return pattern.replace(strReg, (_, key) => params[key]);
};

const flowRename = interpolate('[basename].flow[extname]');
const mjsRename = interpolate('[basename].mjs');

const mains = ['main', 'module', 'browser', 'style', 'types'];

async function findReadme() {
  const [readmePath] = await globby('README{,.*}', {
    absolute: true,
    deep: false,
    case: false,
    transform: (fp) => normalize(fp),
  });
  return readmePath;
}

async function findLicense() {
  const [licensePath] = await globby('LICEN{S,C}E{,.*}', {
    absolute: true,
    deep: false,
    case: false,
    transform: (fp) => normalize(fp),
  });
  return licensePath;
}

async function createPublishPkgJson(outDir) {
  let pkgJson;
  try {
    pkgJson = await readJson(join(process.cwd(), 'package.json'));
  } catch (err) {
    console.error('No readable package.json at this root', err);
  }

  delete pkgJson.files; // because otherwise it would be wrong
  delete pkgJson.scripts;
  delete pkgJson.devDependencies;

  // remove folder part from path
  // lets the root pkg.json's main be accurate in case you want to install from github
  const rMain = new RegExp(`${outDir}\\/?`);

  for (const main of mains) {
    if (!pkgJson[main]) continue;
    pkgJson[main] = pkgJson[main].replace(rMain, '');
  }

  await outputJson(join(outDir, 'package.json'), pkgJson, {
    spaces: 2,
  });
}

const createAltPublishDir = async ({ publishDir }) => {
  await createPublishPkgJson(publishDir);

  const readme = await findReadme();
  if (readme) await copyFile(readme, join(publishDir, _basename(readme)));

  const license = await findLicense();
  if (license) await copyFile(license, join(publishDir, _basename(license)));
};

const renameMjs = ({ src, pattern, outDir }) =>
  cpy(pattern, `../${outDir}`, {
    cwd: src,
    parents: true,
    rename: mjsRename,
  });

const renameFlowTypes = ({ src, pattern, outDir }) =>
  cpy(pattern, `../${outDir}`, {
    cwd: src,
    parents: true,
    rename: flowRename,
  });

const renameFiles = ({ src, pattern, outDir, rename }) =>
  cpy(pattern, `../${outDir}`, {
    cwd: src,
    parents: true,
    rename(filename) {
      if (!rename) return filename;
      return interpolate(rename)(filename);
    },
  });

export default {
  createAltPublishDir,
  renameMjs,
  renameFlowTypes,
  renameFiles,
};
