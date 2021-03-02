#!/usr/bin/env node

const yargs = require('yargs');

function setCmdName(name, cmd) {
  return {
    ...cmd,
    command: cmd.command.replace(/^\$0/, name),
  };
}

yargs
  .help()
  .alias('h', 'help')
  .version()
  .alias(`v`, `version`)
  .wrap(yargs.terminalWidth())
  .strict()
  .command(setCmdName('install', require('./install')))
  .command(setCmdName('uninstall', require('./uninstall')))
  .parse(process.argv.slice(2));
