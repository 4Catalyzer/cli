const fs = require('fs-extra');
const shell = require('shelljs');
const tmp = require('tmp');

const {
  updateChangelog,
  recommendedBump,
} = require('../conventional-commits.js');

const commit = (...msgs) =>
  shell.exec(
    `git commit -m "${msgs.join('" -m "')}" --allow-empty --no-gpg-sign`,
  );

const bump = async (version) => {
  await fs.writeJson(
    './package.json',
    Object.assign(fs.readJsonSync('./package.json'), {
      version,
    }),
  );
  shell.exec('git add .');
  commit(`bump version: ${version}`);
};

describe('conventional-commits', () => {
  let tmpDir;
  beforeEach(async () => {
    shell.config.silent = true;
    tmpDir = tmp.dirSync({ unsafeCleanup: true });
    shell.cd(tmpDir.name);
    shell.mkdir('git-templates');
    shell.exec('git init --template=./git-templates');
    await fs.writeJson('./package.json', {
      name: '@4c/rollout',
      version: '1.1.0',
      repository: {
        type: 'git',
        url: 'https://github.com/4Catalyzer/init.git',
      },
    });
    shell.exec('git add .');
    commit('First commit');
    await bump('1.0.0');
    shell.exec('git tag v1.0.0');
  });

  afterEach(() => {
    tmpDir.removeCallback();
  });

  it('should recommend a bump', async () => {
    commit('feat: something');
    commit('fix: another thing');

    const releaseType = await recommendedBump('1.0.0');

    expect(releaseType).toEqual('minor');
  });

  it('should handle major bumps', async () => {
    commit('fix: another thing', 'BREAKING CHANGE: something');

    const releaseType = await recommendedBump('1.0.0');

    expect(releaseType).toEqual('major');
  });

  it('should handle prerelease bumps', async () => {
    commit('feat: something');
    commit('fix: another thing');

    const releaseType = await recommendedBump('1.0.0-beta.0');

    expect(releaseType).toEqual(null);
  });

  it('should handle pre major patch bumps', async () => {
    commit('feat: something');
    commit('fix: another thing');

    const releaseType = await recommendedBump('0.5.3');

    expect(releaseType).toEqual('patch');
  });

  it('should handle pre major breaking bumps', async () => {
    commit('fix: another thing', 'BREAKING CHANGE: something');

    const releaseType = await recommendedBump('0.5.3');

    expect(releaseType).toEqual('minor');
  });

  it('should create a changelog', async () => {
    commit('feat: something');
    commit('fix: another thing');

    await updateChangelog(tmpDir.name, '1.1.0');

    let changelog = await fs.readFile('./CHANGELOG.md', 'utf8');

    expect(changelog.includes('* another thing')).toEqual(true);
    expect(changelog.includes('* something')).toEqual(true);

    shell.exec('git tag v1.1.0');

    commit('feat: something', 'BREAKING CHANGE: something');

    await updateChangelog(tmpDir.name, '2.0.0');

    changelog = await fs.readFile('./CHANGELOG.md', 'utf8');

    expect(changelog.includes('### BREAKING CHANGES')).toEqual(true);
    expect(changelog.includes('* another thing')).toEqual(true);
  });
});
