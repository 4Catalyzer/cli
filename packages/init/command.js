// Cherry pick to avoid pulling in all of core-js
// see: https://github.com/plopjs/node-plop/pull/163

import { fileURLToPath } from 'url';

import { symbols } from '@4c/cli-core/ConsoleUtilities';
import nodePlop from 'node-plop';

export const command = '$0 [location]';

export const describe = 'create a new package';

export function builder(_) {
  return _.positional('location', {
    type: 'string',
    default: process.cwd(),
    describe: 'the location of the package',
    normalize: true,
  });
}

const filePath = fileURLToPath(new URL('plopfile.js', import.meta.url));

async function handlerImpl({ location }) {
  const plop = await nodePlop(filePath);

  const newPkg = plop.getGenerator('new-package');

  const answers = await newPkg.runPrompts([location]);
  const result = await newPkg.runActions(answers);

  if (result.failures) {
    result.failures.forEach(
      (f) =>
        (!f.error || !f.error.startsWith('Aborted due to previous')) &&
        console.error(f.message || f.error),
    );
  }
}

export const handler = (argv) =>
  handlerImpl(argv).catch((err) => {
    console.error(`\n${symbols.error} ${err.message}`);
    process.exit(1);
  });
