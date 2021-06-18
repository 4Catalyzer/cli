const path = require('path');

const execa = require('execa');
const gitDefaultBranch = require('git-default-branch');
const slash = require('slash');

function hasTag(tag) {
  return execa('git', [
    'rev-parse',
    '-q',
    '--verify',
    `refs/tags/${tag}`,
  ]).then(
    () => true,
    () => false,
  );
}
const repoName = (name) => name.replace(/^@.+\//, '');

exports.repoName = repoName;

exports.getDefaultBranch = () => gitDefaultBranch();

exports.getRemoteUrl = (cwd) =>
  execa('git', ['config', 'remote.origin.url'], { cwd })
    .then((r) => r.stdout)
    .catch(() => '');

exports.remoteUrl = (name, org = '4Catalyzer') =>
  `https://github.com/${org}/${repoName(name)}.git`;

exports.isGitRepo = (dest) =>
  execa('git', ['rev-parse'], { cwd: dest, stdio: 'ignore' })
    .then(() => true)
    .catch(() => false);

exports.init = (dest) =>
  exports
    .isGitRepo(dest)
    .then(
      (isGit) =>
        !isGit && execa('git', ['init'], { cwd: dest, stdio: 'inherit' }),
    );

exports.addFile = (file) =>
  execa('git', [
    'add',
    slash(path.relative(process.cwd(), path.resolve(process.cwd(), file))),
  ]);

exports.commit = (message) =>
  execa('git', ['commit', '--no-verify', '-m', message]);

exports.removeLastCommit = () => execa('git', ['reset', 'HEAD~1', '--hard']);

exports.assertClean = async () => {
  const result = await execa('git', ['status', '--porcelain']).then(
    (d) => d.stdout,
  );

  if (result !== '')
    throw new Error(
      'Git working tree is not clean, please commit or stash any unstaged changes',
    );
};

exports.assertMatchesRemote = async () => {
  const result = await execa('git', [
    'rev-list',
    '--count',
    '--left-only',
    '@{u}...HEAD',
  ]).then((d) => d.stdout);

  if (result !== '0')
    throw new Error('The remote differs from the local working tree');
};

exports.addRemote = (dest, name, org) =>
  execa('git', ['remote', 'add', 'origin', exports.remoteUrl(name, org)], {
    cwd: dest,
    stdio: 'inherit',
  }).catch((err) => {
    if ((err.stderr || '').match(/remote origin already exists/)) return;
    throw err;
  });

exports.addTag = async (tag) => {
  if (await hasTag(tag)) return;
  await execa('git', ['tag', tag, '-m', tag]);
};

exports.removeTag = (tag) => execa('git', ['tag', '-d', tag]);
exports.getCurrentBranch = (opts) =>
  execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], opts).then(
    (r) => r.stdout,
  );

exports.pushWithTags = () => execa('git', ['push', '--follow-tags']);
