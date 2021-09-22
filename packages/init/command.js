// Cherry pick to avoid pulling in all of core-js
// see: https://github.com/plopjs/node-plop/pull/163

import { fileURLToPath } from 'url';

import { symbols } from '@4c/cli-core/ConsoleUtilities';
import nodePlop from 'node-plop/lib/node-plop.js';

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

const filePath = fileURLToPath(new URL('plopfile.cjs', import.meta.url));

async function handlerImpl({ location }) {
  const plop = nodePlop.default(filePath);

  // we need to wait for the promise in plopfile.js to resolve out of band
  // because plop doesn't await it internally and this is the only way to get ESM
  // working since it requires the file we pass in
  await import('./plopfile.cjs').then((m) => m.ready);

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
