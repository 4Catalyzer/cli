const yargs = require('yargs');

module.exports = (
  { command, describe, handler, builder },
  argv = process.argv.slice(2),
) =>
  yargs
    .help()
    .alias('h', 'help')
    .version()
    .alias(`v`, `version`)
    .wrap(yargs.terminalWidth())
    .strict()
    .command(command, describe, builder, handler)
    .parse(argv);
