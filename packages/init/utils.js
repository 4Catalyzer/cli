import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import glob from 'glob';
import prettier from 'prettier';

const templatePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  './templates',
);

// my own convention of naming scoped repo's like 4c-foo on disk
const getPackageNameFromPath = (scope, outDir) => {
  let name = basename(outDir);

  if (!scope) return name;
  name = name.replace(new RegExp(`^${scope.slice(1)}-`), '');
  return `${scope}/${name}`;
};

const sortJsonPath = (jsonFile, paths) => {
  const obj = JSON.parse(readFileSync(jsonFile));
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

  writeFileSync(jsonFile, JSON.stringify(obj, null, 2));
};

const runPrettier = (pattern, cwd) =>
  glob
    .sync(pattern, { cwd, absolute: true, dot: true })
    .map((filepath) =>
      writeFileSync(
        filepath,
        prettier.format(readFileSync(filepath, 'utf8'), { filepath }),
      ),
    );

export { getPackageNameFromPath, templatePath, sortJsonPath, runPrettier };
