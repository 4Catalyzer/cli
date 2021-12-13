import { relative, resolve } from 'path';

import { execa } from 'execa';
import gitDefaultBranch from 'git-default-branch';
import slash from 'slash';

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
export const repoName = (name) => name.replace(/^@.+\//, '');

export function getDefaultBranch() {
  return gitDefaultBranch();
}

export function getRemoteUrl(cwd) {
  return execa('git', ['config', 'remote.origin.url'], { cwd })
    .then((r) => r.stdout)
    .catch(() => '');
}

export function remoteUrl(name, org = '4Catalyzer') {
  return `https://github.com/${org}/${repoName(name)}.git`;
}

export function isGitRepo(dest) {
  return execa('git', ['rev-parse'], { cwd: dest, stdio: 'ignore' })
    .then(() => true)
    .catch(() => false);
}

export function init(dest) {
  return isGitRepo(dest).then(
    (isGit) =>
      !isGit && execa('git', ['init'], { cwd: dest, stdio: 'inherit' }),
  );
}

export function addFile(file) {
  return execa('git', [
    'add',
    slash(relative(process.cwd(), resolve(process.cwd(), file))),
  ]);
}

export function commit(message) {
  return execa('git', ['commit', '--no-verify', '-m', message]);
}

export function removeLastCommit() {
  return execa('git', ['reset', 'HEAD~1', '--hard']);
}

export async function assertClean() {
  const result = await execa('git', ['status', '--porcelain']).then(
    (d) => d.stdout,
  );

  if (result !== '')
    throw new Error(
      'Git working tree is not clean, please commit or stash any unstaged changes',
    );
}

export async function assertMatchesRemote() {
  const result = await execa('git', [
    'rev-list',
    '--count',
    '--left-only',
    '@{u}...HEAD',
  ]).then((d) => d.stdout);

  if (result !== '0')
    throw new Error('The remote differs from the local working tree');
}

export function addRemote(dest, name, org) {
  return execa('git', ['remote', 'add', 'origin', remoteUrl(name, org)], {
    cwd: dest,
    stdio: 'inherit',
  }).catch((err) => {
    if ((err.stderr || '').match(/remote origin already exists/)) return;
    throw err;
  });
}

export async function addTag(tag) {
  if (await hasTag(tag)) return;
  await execa('git', ['tag', tag, '-m', tag]);
}

export function removeTag(tag) {
  return execa('git', ['tag', '-d', tag]);
}
export function getCurrentBranch(opts) {
  return execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], opts).then(
    (r) => r.stdout,
  );
}

export function pushWithTags() {
  return execa('git', ['push', '--follow-tags']);
}
