const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const execa = require('execa');
const semver = require('semver');
const { createAltPublishDir } = require('@4c/file-butler');

const GitUtilities = require('@4c/cli-core/GitUtilities');
const ConsoleUtilities = require('@4c/cli-core/ConsoleUtilities');
const PromptUtilities = require('@4c/cli-core/PromptUtilities');
const { updateChangelog, recommendedBump } = require('./conventional-commits');

const writeJson = (p, json) => fs.writeJson(p, json, { spaces: 2 });

async function runLifecycle(script, pkg) {
  if (!pkg.scripts || !pkg.scripts[script]) return;
  await execa('npm', ['run', script], { stdio: [0, 1, 'pipe'] });
}

async function maybeRollbackGit(tag, skipGit, skipVersion) {
  if (skipGit) return;
  const confirmed = await PromptUtilities.confirm(
    'There was a problem publishing, do you want to rollback the git operations?',
  );
  await ConsoleUtilities.step(
    `Rolling back git operations`,
    async () => {
      await GitUtilities.removeTag(tag);
      if (!skipVersion) await GitUtilities.removeLastCommit();
    },
    !confirmed,
  );
}

async function getNextVersion(version, currentVersion, preid) {
  const patch = semver.inc(currentVersion, 'patch');
  const minor = semver.inc(currentVersion, 'minor');
  const major = semver.inc(currentVersion, 'major');
  const prepatch = semver.inc(currentVersion, 'prepatch');
  const preminor = semver.inc(currentVersion, 'preminor');
  const premajor = semver.inc(currentVersion, 'premajor');

  if (semver.valid(version)) {
    return version;
  }
  switch (version) {
    case 'patch':
      return patch;
    case 'minor':
      return minor;
    case 'major':
      return major;
    default:
  }

  const message = `Select a new version (currently ${currentVersion})`;

  const choice = await PromptUtilities.select(message, {
    choices: [
      { value: patch, name: `Patch (${patch})` },
      { value: minor, name: `Minor (${minor})` },
      { value: major, name: `Major (${major})` },
      { value: prepatch, name: `Prepatch (${prepatch})` },
      { value: preminor, name: `Preminor (${preminor})` },
      { value: premajor, name: `Premajor (${premajor})` },
      { value: 'PRERELEASE', name: 'Prerelease' },
      { value: 'CUSTOM', name: 'Custom' },
    ],
  });

  switch (choice) {
    case 'CUSTOM': {
      return PromptUtilities.input('Enter a custom version', {
        filter: semver.valid,
        validate: v => v !== null || 'Must be a valid semver version',
      });
    }

    case 'PRERELEASE': {
      const [existingId] = semver.prerelease(currentVersion) || [];
      const defaultVersion = semver.inc(
        currentVersion,
        'prerelease',
        existingId,
      );
      const prompt = `(default: ${
        existingId ? `"${existingId}"` : 'none'
      }, yielding ${defaultVersion})`;

      const nextPreId =
        preid !== 'latest'
          ? preid
          : await PromptUtilities.input(
              `Enter a prerelease identifier ${prompt}`,
            );

      return semver.inc(currentVersion, 'prerelease', nextPreId);
    }

    default: {
      return choice;
    }
  }
}

async function npmPublish(
  spinner,
  pkgJson,
  options,
  otpMessage = 'Enter one time password:',
) {
  const { publishDir, otp, isPublic, tag } = options;
  const args = ['publish'];

  if (publishDir) {
    args.push(publishDir, '--ignore-scripts');

    // We run the lifecycle scripts manually to ensure they run in
    // the package root, not the publish dir
    await runLifecycle('prepublish', pkgJson);
    await runLifecycle('prepare', pkgJson);
    await runLifecycle('prepublishOnly', pkgJson);

    // do this after lifecycle scripts in case they clean the publishDir
    await createAltPublishDir({ outDir: publishDir });
  }
  if (otp) {
    args.push('--otp', otp);
  }

  if (tag !== 'latest') {
    args.push('--tag', tag);
  }

  if (isPublic != null) {
    args.push('--access', isPublic ? 'public' : 'restricted');
  }

  try {
    return execa('npm', args, { stdio: [0, 1, 'pipe'] });
  } catch (err) {
    if (err.stderr.includes('OTP')) {
      spinner.stop();
      const nextOtp = await PromptUtilities.input(otpMessage);
      spinner.start();
      return npmPublish(
        spinner,
        pkgJson,
        { ...options, otp: nextOtp },
        'One time password was incorrect, try again:',
      );
    }
    throw err;
  }
}

exports.command = '$0 [nextVersion]';

exports.describe = 'Publish a new version';

exports.builder = _ =>
  _.positional('nextVersion', {
    type: 'string',
    describe: 'The next version',
  })
    .pkgConf('release')
    .option('preid', {
      type: 'string',
    })
    .option('prerelease', {
      type: 'bool',
    })
    .option('otp', {
      type: 'string',
    })
    .option('publish-dir', {
      type: 'string',
      describe: 'Provide a two-factor authentication code for publishing',
    })
    .option('conventional-commits', {
      describe:
        'Use conventional-changelog to calculate the next version and build changelog, from the commit history',
      type: 'bool',
    })
    .option('allow-branch', {
      describe: 'Specify which branches to allow publishing from.',
      type: 'array',
      default: ['master'],
    })
    .option('npm-tag', {
      type: 'string',
    })
    .option('skip-version', {
      describe: 'Skip version bumping',
      type: 'boolean',
    })
    .option('skip-checks', {
      describe: 'Skip tests, linting and git hygiene checks',
      type: 'boolean',
    })
    .option('skip-git', {
      describe: 'Skip commiting, tagging, and pushing git changes.',
      type: 'boolean',
    })
    .option('skip-npm', {
      describe: 'Stop before actually publishing change to npm.',
      type: 'boolean',
    })
    .option('public', {
      type: 'boolean',
      default: undefined,
    });

exports.handler = async ({
  preid,
  nextVersion: version,
  npmTag,
  skipChecks,
  skipGit,
  skipNpm,
  skipVersion,
  allowBranch,
  publishDir,
  conventionalCommits,
  otp,
  public: isPublic,
}) => {
  const cwd = process.cwd();
  const changelogPath = path.join(cwd, 'CHANGELOG.md');
  const pkgPath = path.join(cwd, 'package.json');
  const pkg = require(pkgPath);

  try {
    await ConsoleUtilities.step(
      'Checking repo and running tests',
      async () => {
        if (!skipGit) {
          await GitUtilities.assertClean();
          await GitUtilities.assertMatchesRemote();
        }
        const branch = await GitUtilities.getCurrentBranch();

        if (!allowBranch.includes(branch))
          throw new Error(`Cannot publish from branch: ${chalk.bold(branch)}`);

        await execa('npm', ['test'], { stdio: [0, 1, 'pipe'] });
      },
      skipChecks,
    );

    let nextVersion = pkg.version;

    if (skipVersion) {
      ConsoleUtilities.spinner().warn(
        `Using existing version: ${chalk.bold(nextVersion)}`,
      );
    } else {
      if (conventionalCommits) {
        version = (await recommendedBump(pkg.version)) || version; // eslint-disable-line no-param-reassign
      }

      nextVersion = await getNextVersion(version, pkg.version, preid);

      await ConsoleUtilities.step(
        `Bumping version to: ${chalk.bold(nextVersion)}  (${chalk.dim(
          `was ${pkg.version}`,
        )})`,
        () =>
          writeJson(path.join(cwd, 'package.json'), {
            ...pkg,
            version: nextVersion,
          }),
      );
    }

    const isPrerelease = !!semver.prerelease(nextVersion);
    const tag = npmTag || isPrerelease ? 'next' : 'latest';

    const confirmed = await PromptUtilities.confirm(
      `Are you sure you want to publish version: ${nextVersion}@${tag}?`,
    );

    if (!confirmed) return;
    const gitTag = `v${nextVersion}`;

    await ConsoleUtilities.step(
      'Tagging and committing version bump',
      async () => {
        if (conventionalCommits) {
          await updateChangelog(cwd, nextVersion);
        }

        if (!skipVersion) {
          try {
            await GitUtilities.addFile(changelogPath);
          } catch (err) {
            /* ignore */
          }

          await GitUtilities.addFile(pkgPath);
          await GitUtilities.commit(`Publish ${gitTag}`);
        }
        await GitUtilities.addTag(gitTag);
      },
      skipGit,
    );

    try {
      await ConsoleUtilities.step(
        'Publishing to npm',
        async spinner => {
          await npmPublish(spinner, pkg, { otp, publishDir, isPublic, tag });

          try {
            if (publishDir) {
              await runLifecycle('publish', pkg);
              await runLifecycle('postpublish', pkg);
            }
          } catch (err) {
            console.error(err);
            /* we've already published so we shouldn't try and rollback if these fail */
          }
        },
        skipNpm,
      );
    } catch (err) {
      await maybeRollbackGit(gitTag, skipGit, skipVersion);
      throw err;
    }

    if (!skipGit) {
      await GitUtilities.pushWithTags();
    }

    console.log(
      `🎉  Published v${nextVersion}@${tag}:  ${chalk.blue(
        skipNpm
          ? await GitUtilities.getRemoteUrl()
          : `https://npm.im/${pkg.name}`,
      )} \n`,
    );
  } catch (err) {
    /* ignore */
  }
};
