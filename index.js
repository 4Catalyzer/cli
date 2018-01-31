const yargs = require('yargs');
const newCommand = require('./commands/new');

yargs
  .help()
  .alias('h', 'help')
  .version()
  .alias(`v`, `version`)
  .wrap(yargs.terminalWidth())
  .demandCommand(1, `Pass --help to see all available commands and options.`)
  .strict()
  .showHelpOnFail(true)
  .recommendCommands()
  .command(newCommand)
  .parse(process.argv.slice(2));
