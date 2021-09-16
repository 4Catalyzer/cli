#!/usr/bin/env node

import Yargs from 'yargs';

import * as Install from './install.js';
import * as Uninstall from './uninstall.js';

const yargs = Yargs();
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
  .command(setCmdName('install', Install))
  .command(setCmdName('uninstall', Uninstall))
  .parse(process.argv.slice(2));
