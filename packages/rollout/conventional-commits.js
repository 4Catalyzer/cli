import { EOL } from 'os';
import { join } from 'path';
import { promisify } from 'util';

import conventionalChangelog from 'conventional-changelog';
import conventionalRecommendedBump from 'conventional-recommended-bump';
import fsExtra from 'fs-extra';
import semver from 'semver';

const bump = promisify(conventionalRecommendedBump);

const BLANK_LINE = EOL + EOL;

export async function recommendedBump(
  currentVersion,
  { preset = 'angular' } = {},
) {
  if (semver.prerelease(currentVersion)) return null;

  let { releaseType } = await bump({ preset });

  // Pre-v1 node idioms
  if (semver.lt(currentVersion, '1.0.0')) {
    if (releaseType === 'major') releaseType = 'minor';
    else if (releaseType === 'minor') releaseType = 'patch';
  }
  return releaseType;
}

export async function updateChangelog(
  cwd,
  version,
  { preset = 'angular' } = {},
) {
  const outFile = join(cwd, 'CHANGELOG.md');
  const existing = await fsExtra
    .readFile(join(cwd, 'CHANGELOG.md'), 'utf8')
    .catch(() => '');

  const stream = conventionalChangelog(
    {
      preset,
      pkg: { path: join(cwd, 'package.json') },
      outputUnreleased: true,
      warn: console.warn,
    },
    { version },
  );

  let changelog = BLANK_LINE + existing;
  for await (const item of stream) {
    changelog = item.toString() + changelog;
  }

  await fsExtra.outputFile(outFile, changelog);
}
