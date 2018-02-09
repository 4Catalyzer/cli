const execa = require('execa');
const path = require('path');
const slash = require('slash');

exports.init = dest => execa('git', ['init'], { cwd: dest, stdio: 'inherit' });

exports.addFile = file =>
  execa('git', [
    'add',
    slash(path.relative(process.cwd(), path.resolve(process.cwd(), file))),
  ]);

exports.commit = message =>
  execa('git', ['commit', '--no-verify', '-m', message]);

exports.assertClean = async () => {
  if ((await execa.stdout('git', ['status', '--porcelain'])) !== '')
    throw new Error(
      'Git working tree is not clean, please commit or stash any unstaged changes',
    );
};

exports.assertMatchesRemote = async () => {
  if (
    (await execa.stdout('git', [
      'rev-list',
      '--count',
      '--left-only',
      '@{u}...HEAD',
    ])) !== '0'
  )
    throw new Error('The remote differs from the local working tree');
};

exports.addRemote = (name, org = '4catalyzer') => {
  try {
    execa(
      'git',
      [
        'remote',
        'add',
        'origin',
        `git@github.com:${org}/${name.replace(/^@4c\//, '')}.git`,
      ],
      { cwd: name, stdio: [0, 1, 'pipe'] },
    );
  } catch (err) {
    if ((err.stderr || '').match(/remote origin already exists/)) return;
    throw err;
  }
};

exports.addTag = async tag => {
  const hasTag = await execa.stdout('git', [
    'rev-parse',
    '-q',
    '--verify',
    `refs/tags/${tag}`,
  ]);
  console.log(hasTag);
  if (hasTag) return;
  await execa('git', ['tag', tag, '-m', tag]);
};

exports.removeTag = tag => execa('git', ['tag', '-d', tag]);

exports.getCurrentBranch = opts =>
  execa.stdout('git', ['rev-parse', '--abbrev-ref', 'HEAD'], opts);

exports.pushWithTags = () => execa('git', ['push', '--follow-tags']);
