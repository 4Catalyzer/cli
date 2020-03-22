const fs = require('fs');
const path = require('path');

const glob = require('glob');
const prettier = require('prettier');

const templatePath = path.resolve(__dirname, './templates');

// my own convention of naming scoped repo's like 4c-foo on disk
const getPackageNameFromPath = (scope, outDir) => {
  let name = path.basename(outDir);

  if (!scope) return name;
  name = name.replace(new RegExp(`^${scope.slice(1)}-`), '');
  return `${scope}/${name}`;
};

const sortJsonPath = (jsonFile, paths) => {
  const obj = require(jsonFile);
  paths.forEach((p) => {
    if (!obj[p]) return;

    const result = {};
    Object.keys(obj[p])
      .sort()
      .forEach((k) => {
        result[k] = obj[p][k];
      });

    obj[p] = result;
  });

  fs.writeFileSync(jsonFile, JSON.stringify(obj, null, 2));
};

const runPrettier = (pattern, cwd) =>
  glob
    .sync(pattern, { cwd, absolute: true, dot: true })
    .map((filepath) =>
      fs.writeFileSync(
        filepath,
        prettier.format(fs.readFileSync(filepath, 'utf8'), { filepath }),
      ),
    );

module.exports = {
  getPackageNameFromPath,
  templatePath,
  sortJsonPath,
  runPrettier,
};
