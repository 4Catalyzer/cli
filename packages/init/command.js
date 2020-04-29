// Cherry pick to avoid pulling in all of core-js
// see: https://github.com/plopjs/node-plop/pull/163
const nodePlop = require('node-plop/lib/node-plop').default;

// load an instance of plop from a plopfile

exports.command = '$0 [location]';

exports.describe = 'create a new package';

exports.builder = (_) =>
  _.positional('location', {
    type: 'string',
    default: process.cwd(),
    describe: 'the location of the package',
    normalize: true,
  });

exports.handler = async ({ location }) => {
  const plop = nodePlop(`${__dirname}/plopfile.js`);
  const newPkg = plop.getGenerator('new-package');

  const answers = await newPkg.runPrompts([location]);
  const result = await newPkg.runActions(answers);
  if (result.failures) {
    result.failures.forEach(
      (f) =>
        f.error &&
        !f.error.startsWith('Aborted due to previous') &&
        console.error(f.error),
    );
  }
};
