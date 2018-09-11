const conventionalRecommendedBump = require('conventional-recommended-bump');
const semver = require('semver');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const conventionalChangelog = require('conventional-changelog');
const { promisify } = require('util');

const bump = promisify(conventionalRecommendedBump);

const BLANK_LINE = os.EOL + os.EOL;

exports.recommendedBump = async (
  currentVersion,
  { preset = 'angular' } = {},
) => {
  if (semver.prerelease(currentVersion)) return null;

  let { releaseType } = await bump({ preset });

  // Pre-v1 node idioms
  if (semver.lt(currentVersion, '1.0.0')) {
    if (releaseType === 'major') releaseType = 'minor';
    else if (releaseType === 'minor') releaseType = 'patch';
  }
  return releaseType;
};

exports.updateChangelog = async (
  cwd,
  version,
  { preset = 'angular' } = {},
) => {
  const outFile = path.join(cwd, 'CHANGELOG.md');
  const existing = await fs
    .readFile(path.join(cwd, 'CHANGELOG.md'), 'utf8')
    .catch(() => '');

  const stream = conventionalChangelog(
    {
      preset,
      pkg: { path: path.join(cwd, 'package.json') },
      outputUnreleased: true,
      warn: console.warn,
    },
    { version },
  );

  let changelog = BLANK_LINE + existing;
  for await (const item of stream) {
    changelog = item.toString() + changelog;
  }

  await fs.outputFile(outFile, changelog);
};
