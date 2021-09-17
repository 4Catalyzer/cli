import { relative, resolve } from 'path';

import cpy from 'cpy';
import fsExtra from 'fs-extra';

const relativeOut = (src, outDir) => relative(resolve(src), resolve(outDir));

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

      if (!fsExtra.statSync(base).isDirectory()) {
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

export { copy, copyRest };
