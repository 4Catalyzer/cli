#!/usr/bin/env node

const yargs = require('yargs');
const newCommand = require('./commands/new');
const releaseCommand = require('./commands/release');

yargs
  .help()
  .alias('h', 'help')
  .version()
  .alias(`v`, `version`)
  .wrap(yargs.terminalWidth())
  .demandCommand(1, `Pass --help to see all available commands and options.`)
  .strict()
  .recommendCommands()
  .command(newCommand)
  .command(releaseCommand)
  .parse(process.argv.slice(2));
