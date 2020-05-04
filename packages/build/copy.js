const path = require('path');

const cpy = require('cpy');
const fs = require('fs-extra');

const relativeOut = (src, outDir) =>
  path.relative(path.resolve(src), path.resolve(outDir));

function copy(patterns, base, outDir) {
  return cpy(
    [...patterns, '!**/__tests__/', '!**/__mocks__/'],
    relativeOut(base, outDir),
    {
      cwd: base,
      parents: true,
      debug: true,
    },
  );
}

function copyRest(sources, outDir, extensions) {
  return Promise.all(
    sources.map((base) => {
      // babel allows this, tho we don't usually specify file names in
      if (!fs.statSync(base).isDirectory()) {
        return cpy([base, '!**/__tests__/**', '!**/__mocks__/**'], outDir);
      }

      return copy(
        [
          '**/*',
          ...extensions.map((ext) => `!**/*${ext}`),
          // need to re-include .d.ts files b/c they should be copied
          '**/*.d.ts',
        ],
        base,
        outDir,
      );
    }),
  );
}

module.exports = { copy, copyRest };
