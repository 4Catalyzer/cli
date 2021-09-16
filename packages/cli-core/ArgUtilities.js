import globby from 'globby';

export function resolveFilePatterns(
  patterns,
  { ignoreNodeModules = true, ...rest } = {},
) {
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

  return globby(fullPatterns, { dot: true, nodir: true, ...rest });
}
