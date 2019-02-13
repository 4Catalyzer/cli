#!/usr/bin/env node

const init = require('@4c/init/command');
const rollout = require('@4c/rollout/command');
const yargs = require('yargs');
const intl = require('@4c/intl/command');
const pedantic = require('pedantic/command');

const setCmdName = (name, cmd) => ({
  ...cmd,
  command: cmd.command.replace(/^\$0/, name),
});

yargs
  .help()
  .alias('h', 'help')
  .version()
  .alias(`v`, `version`)
  .wrap(yargs.terminalWidth())
  .demandCommand(1, `Pass --help to see all available commands and options.`)
  .strict()
  .recommendCommands()
  .command(setCmdName('init', init))
  .command(setCmdName('release', rollout))
  .command(setCmdName('intl', intl))
  .command(setCmdName('format', pedantic))
  .parse(process.argv.slice(2));
