const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const execa = require('execa');
const semver = require('semver');
const rimraf = require('rimraf');
const hasYarn = require('has-yarn');
const { promisify } = require('util');

const Listr = require('listr');
const { from } = require('rxjs');
const { catchError } = require('rxjs/operators');
const { createAltPublishDir } = require('@4c/file-butler');

const GitUtilities = require('@4c/cli-core/GitUtilities');
const ConsoleUtilities = require('@4c/cli-core/ConsoleUtilities');
const PromptUtilities = require('@4c/cli-core/PromptUtilities');
const { readPackageJson } = require('@4c/cli-core/ConfigUtilities');
const handleNpmError = require('./handleNpmError');
const { updateChangelog, recommendedBump } = require('./conventional-commits');
const { exec } = require('./rx');

const writeJson = (p, json) => fs.writeJson(p, json, { spaces: 2 });

async function runLifecycle(script, pkg) {
  if (!pkg.scripts || !pkg.scripts[script]) return;
  await execa('npm', ['run', script]);
}

let rolledBack = false;
async function maybeRollbackGit(tag, skipGit, skipVersion) {
  if (skipGit || rolledBack) return;
  const confirmed = await PromptUtilities.confirm(
    'There was a problem publishing, do you want to rollback the git operations?',
  );

  rolledBack = true;
  if (!confirmed) return;

  await GitUtilities.removeTag(tag);
  if (!skipVersion) await GitUtilities.removeLastCommit();
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

async function npmPublish(pkgJson, options) {
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
    await createAltPublishDir({ publishDir });
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

  const child = await execa('npm', args, { stdio: [0, 1, 'pipe'] });

  if (publishDir) {
    await runLifecycle('publish', pkgJson);
    await runLifecycle('postpublish', pkgJson);
  }

  return child;
}

function runTasks(tasks) {
  return new Listr(tasks.filter(Boolean)).run();
}

exports.command = '$0 [nextVersion]';

exports.describe = 'Publish a new version';

exports.builder = _ =>
  _.positional('nextVersion', {
    type: 'string',
    describe: 'The next version',
  })
    .option('preid', {
      type: 'string',
    })
    .option('prerelease', {
      type: 'bool',
    })
    .option('otp', {
      type: 'string',
      describe: 'Provide a two-factor authentication code for publishing',
    })
    .option('publish-dir', {
      type: 'string',
      describe:
        'An alternative directory to publish besides the package root. ' +
        '`publishDir` will also be read from package.json field `publishConfig.directory`.',
    })
    .option('conventional-commits', {
      describe:
        'Use conventional-changelog to calculate the next version and build changelog, from the commit history',
      type: 'bool',
    })
    .option('allow-branch', {
      describe: 'Specify which branches to allow publishing from.',
      type: 'array',
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

const handler = async argv => {
  const cwd = process.cwd();
  const changelogPath = path.join(cwd, 'CHANGELOG.md');
  const { path: pkgPath, packageJson } = await readPackageJson({ cwd });

  const {
    otp,
    preid,
    npmTag,
    skipChecks,
    skipGit,
    skipNpm,
    skipVersion,
    conventionalCommits,
    public: isPublic,
    allowBranch = ['master'],
  } = { ...packageJson.release, ...argv };

  let { publishDir, nextVersion: version } = argv;
  const useYarn = hasYarn(cwd);
  const hasLockFile = fs.existsSync(
    path.resolve(useYarn ? './yarn.lock' : './package-lock.json'),
  );

  // lerna
  if (!publishDir && packageJson.publishConfig)
    publishDir = packageJson.publishConfig.directory;
  // older rollout
  if (!publishDir && packageJson.release) {
    publishDir = packageJson.release.publishDir;
    if (publishDir)
      ConsoleUtilities.warn(
        'publishDir in package.json `release` field is deprecated. Use the `publishConfig.directory` field instead.',
      );
  }

  await runTasks([
    {
      title: 'Preforming hygiene checks',
      skip: () => skipChecks,
      task: () =>
        new Listr([
          {
            title: 'Checking that repo is clean',
            task: GitUtilities.assertClean,
          },
          {
            title: 'Local matches remote',
            task: GitUtilities.assertMatchesRemote,
          },
          {
            title: 'Branch allowed',
            task: async () => {
              const branch = await GitUtilities.getCurrentBranch();

              if (!allowBranch.includes(branch))
                throw new Error(
                  `Cannot publish from branch: ${chalk.bold(branch)}`,
                );
            },
          },
          {
            title: 'Cleaning existing node_modules',
            task: () => promisify(rimraf)('node_modules'),
          },
          useYarn
            ? {
                title: 'Installing dependencies using Yarn',
                task: () =>
                  exec('yarn', [
                    'install',
                    '--frozen-lockfile',
                    '--production=false',
                  ]),
              }
            : {
                title: 'Installing dependencies using npm',
                task: () =>
                  exec(
                    'npm',
                    hasLockFile
                      ? ['ci']
                      : ['install', '--no-package-lock', '--no-production'],
                  ),
              },
        ]),
    },
    {
      title: 'Running tests',
      task: () => exec('npm', ['test']),
    },
  ]);

  let nextVersion = packageJson.version;

  if (!skipVersion) {
    if (conventionalCommits) {
      version = (await recommendedBump(packageJson.version)) || version; // eslint-disable-line no-param-reassign
    }

    nextVersion = await getNextVersion(version, packageJson.version, preid);
  }

  const isSameVersion = nextVersion === packageJson.version;

  const isPrerelease = !!semver.prerelease(nextVersion);
  const tag = npmTag || isPrerelease ? 'next' : 'latest';

  const confirmed = await PromptUtilities.confirm(
    `Are you sure you want to publish version ${chalk.bold(
      `${nextVersion}@${tag}`,
    )}${publishDir ? ` from sub-directory ${chalk.bold(publishDir)}` : ''}`,
  );

  if (!confirmed) return;
  const gitTag = `v${nextVersion}`;

  try {
    await runTasks([
      {
        title: isSameVersion
          ? 'Bumping package version'
          : `Bumping version to: ${chalk.bold(nextVersion)}  (${chalk.dim(
              `was ${packageJson.version}`,
            )})`,
        skip: () => skipVersion || (isSameVersion && 'Version is unchanged'),
        task: () =>
          writeJson(path.join(cwd, 'package.json'), {
            ...packageJson,
            version: nextVersion,
          }),
      },
      conventionalCommits && {
        title: 'Updating Changelog',
        task: () => updateChangelog(cwd, nextVersion),
      },
      {
        title: 'Tagging and committing version bump',
        skip: () => skipGit,
        task: () =>
          new Listr([
            {
              title: 'Commiting changes',
              task: async () => {
                try {
                  await GitUtilities.addFile(changelogPath);
                  await GitUtilities.addFile(pkgPath);
                  await GitUtilities.commit(`Publish ${gitTag}`);
                } catch (err) {
                  /* ignore */
                }
              },
            },
            {
              title: 'Tagging',
              task: () => GitUtilities.addTag(gitTag),
            },
          ]),
      },
      {
        title: 'Publishing to npm',
        skip: () => skipNpm,
        task: (context, task) => {
          const input = { otp, publishDir, isPublic, tag };

          return from(npmPublish(packageJson, input)).pipe(
            catchError(error =>
              handleNpmError(error, task, nextOtp => {
                // eslint-disable-next-line no-param-reassign
                context.otp = nextOtp;
                return npmPublish(packageJson, { ...input, otp: nextOtp });
              }),
            ),
          );
        },
      },
      !skipGit && {
        title: 'Pushing tags',
        task: GitUtilities.pushWithTags,
      },
    ]);
  } catch (err) {
    await maybeRollbackGit(gitTag, skipGit, skipVersion);

    throw err;
  }

  console.log(
    `\n\n🎉  Published v${nextVersion}@${tag}:  ${chalk.blue(
      skipNpm
        ? await GitUtilities.getRemoteUrl()
        : `https://npm.im/${packageJson.name}`,
    )} \n`,
  );
};

exports.handler = argv =>
  handler(argv).catch(err => {
    console.error(`\n${ConsoleUtilities.symbols.error} ${err.message}`);
    process.exit(1);
  });
