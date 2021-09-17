#!/usr/bin/env node

import Yargs from 'yargs';

import * as Command from './workspaces.js';

Yargs()
  .help()
  .alias('h', 'help')
  .version()
  .alias('v', 'version')
  .wrap(Yargs().terminalWidth())
  .strict()
  .command(Command)
  .parse(process.argv.slice(2));
