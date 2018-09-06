const nodePlop = require('node-plop');

// load an instance of plop from a plopfile

exports.command = '$0 [location]';

exports.describe = 'create a new package';

exports.builder = _ =>
  _.positional('location', {
    type: 'string',
    default: process.cwd(),
    describe: 'the location of the package',
    normalize: true,
  });

exports.handler = async ({ location }) => {
  const plop = nodePlop('./plopfile.js');
  const newPkg = plop.getGenerator('new-package');

  const answers = await newPkg.runPrompts([location]);
  const f = await newPkg.runActions(answers);
  console.log('here', f);
};