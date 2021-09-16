import { existsSync, promises as fs } from 'fs';
import { join } from 'path';
import { debuglog } from 'util';

import findUp from 'find-up';
import hasYarn from 'has-yarn';
import readPkgUp from 'read-pkg-up';

const debug = debuglog('hookem');

const useYarn = hasYarn();

const isHook = (contents) => contents.includes('# hookem');

async function install() {
  const [{ packageJson }, gitDir] = await Promise.all([
    readPkgUp(),
    findUp('.git', { type: 'directory' }),
  ]);

  if (!gitDir) {
    debug('Not a git repo');
    return false;
  }

  const hooks = packageJson?.gitHooks || packageJson?.husky?.hooks;

  if (!hooks) {
    debug('No hooks configured');
    return false;
  }

  const hookDir = join(gitDir, 'hooks');

  if (!existsSync(hookDir)) {
    await fs.mkdir(hookDir);
  }

  return Promise.all(
    Object.entries(hooks).map(async ([hook, cmd]) => {
      const command = useYarn ? `yarn run ${cmd}` : `npx --no-install ${cmd}`;
      const filename = join(hookDir, hook);

      if (existsSync(filename)) {
        const data = await fs.readFile(filename, 'utf-8');
        if (!isHook(data)) {
          return;
        }
      }

      const failMessage = [
        'commit-msg',
        'pre-commit',
        'pre-rebase',
        'pre-push',
      ].includes(hook)
        ? '(add --no-verify to bypass)'
        : '(cannot be bypassed with --no-verify due to Git specs)';

      await fs.writeFile(
        filename,
        `#!/bin/sh
# hookem

echo "Hook'em -> ${hook}"

cmd="${command}"

$cmd

status=$?

if [ $status != 0 ]; then
  echo "${failMessage}";
fi

exit $status;`,
      );

      await fs.chmod(filename, 0o0755);
    }),
  ).then(() => true);
}

async function canRemove(filename) {
  const stat = await fs.stat(filename);

  if (stat.isFile()) {
    const data = await fs.readFile(filename, 'utf-8');
    return isHook(data);
  }

  return false;
}

async function uninstall() {
  const gitDir = await findUp('.git', { type: 'directory' });

  if (!gitDir) return null;

  const hookDir = join(gitDir, 'hooks');

  if (!existsSync(hookDir)) {
    return null;
  }
  const files = await fs.readdir(hookDir);

  return Promise.all(
    files.map(async (hookName) => {
      const filename = join(hookDir, hookName);
      if (await canRemove(filename)) {
        await fs.unlink(filename);
      }
    }),
  );
}

export default { install, uninstall };
