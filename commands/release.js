const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const execa = require('execa');
const npmName = require('npm-name');
const semver = require('semver');

const GitUtilities = require('../GitUtilities');
const ConsoleUtilities = require('../ConsoleUtilities');
const PromptUtilities = require('../PromptUtilities');

const writeJson = (p, json) => fs.writeJson(p, json, { spaces: 2 });

async function getReadme(cwd) {
  return (await fs.readdir(cwd)).find(p =>
    path
      .basename(p)
      .toLowerCase()
      .startsWith('readme'),
  );
}

async function getNextVersion(version, currentVersion, preid) {
  const patch = semver.inc(currentVersion, 'patch');
  const minor = semver.inc(currentVersion, 'minor');
  const major = semver.inc(currentVersion, 'major');
  const prepatch = semver.inc(currentVersion, 'prepatch');
  const preminor = semver.inc(currentVersion, 'preminor');
  const premajor = semver.inc(currentVersion, 'premajor');

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

module.exports = {
  command: 'release [version]',
  describe: 'Publish a new version',
  builder: _ =>
    _.positional('version', {
      type: 'string',
      describe: 'The next version',
    })
      .pkgConf('release')
      .option('preid', {
        type: 'string',
      })
      .option('prerelease', {
        type: 'bool',
        default: false,
      })
      .option('publish-dir', {
        type: 'string',
      })
      .option('allow-branch', {
        group: 'Command Options:',
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
        type: 'bool',
        default: false,
      }),

  async handler({
    preid,
    version,
    npmTag,
    skipChecks,
    skipGit,
    skipNpm,
    skipVersion,
    allowBranch,
    publishDir,
    public: isPublic,
  }) {
    const cwd = process.cwd();
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

          await execa('npm', ['test'], { stdio: [0, 1, 'pipe'] });
        },
        skipChecks,
      );

      let nextVersion = pkg.version;
      let nextPkgJson = pkg;

      if (!skipVersion) {
        nextVersion = await getNextVersion(version, pkg.version, preid);
        nextPkgJson = { ...pkg, version: nextVersion };
      }

      await ConsoleUtilities.step('Updating version and tags', async () => {
        const branch = await GitUtilities.getCurrentBranch();

        if (!allowBranch.includes(branch))
          throw new Error(`Cannot publish from branch: ${chalk.bold(branch)}`);

        if (!skipVersion) {
          await writeJson(pkgPath, nextPkgJson);

          if (publishDir) {
            delete nextPkgJson.files; // because otherwise it would be wrong
            delete nextPkgJson.scripts;
            delete nextPkgJson.devDependencies;
            delete nextPkgJson.rollout;

            // main: 'lib/index.js' -> index.js
            nextPkgJson.main = nextPkgJson.main.replace(
              new RegExp(`${publishDir}\\/?`),
              '',
            );

            const readme = await getReadme(cwd);

            await writeJson(
              path.join(cwd, publishDir, 'package.json'),
              nextPkgJson,
            );

            if (readme)
              await fs.copyFile(
                readme,
                path.join(cwd, publishDir, path.basename(readme)),
              );
          }
        }

        if (!skipGit) {
          const gitTag = `v${nextVersion}`;

          if (!skipVersion) {
            await GitUtilities.addFile(pkgPath);
            await GitUtilities.commit(`"Publish ${gitTag}"`);
          }
          await GitUtilities.addTag(gitTag);
        }
      });

      await ConsoleUtilities.step(
        'Publishing to npm',
        async () => {
          const tag =
            npmTag || semver.prerelease(nextVersion) ? 'next' : 'latest';

          const args = ['publish'];
          if (publishDir) {
            args.push(publishDir);
          }
          if (tag !== 'latest') {
            args.push('--tag', tag);
          }
          if (!await npmName(pkg.name)) {
            args.push('--access', isPublic ? 'public' : 'restricted');
          }
          try {
            await execa('npm', args);
          } catch (err) {
            console.log(err);
          }
        },
        skipNpm,
      );

      if (!skipGit) {
        await GitUtilities.pushWithTags();
      }
    } catch (err) {
      /* ignore */
    }
  },
};
