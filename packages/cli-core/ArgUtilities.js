const globby = require('globby');

exports.resolveFilePatterns = (
  patterns,
  { ignoreNodeModules = true, cwd = process.cwd() } = {},
) => {
  let fullPatterns = patterns;

  if (ignoreNodeModules)
    fullPatterns = fullPatterns.concat([
      '!**/node_modules/**',
      '!./node_modules/**',
    ]);

  fullPatterns = fullPatterns.concat([
    '!**/.{git,svn,hg}/**',
    '!./.{git,svn,hg}/**',
  ]);

  return globby(fullPatterns, { dot: true, nodir: true, cwd });
};
