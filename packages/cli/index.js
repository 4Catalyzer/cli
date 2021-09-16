#!/usr/bin/env node

import * as build from '@4c/build/command';
import init from '@4c/init/command.js';
import intl from '@4c/intl/command.js';
import rollout from '@4c/rollout/command.js';
import * as start from '@4c/start/command.js';
import * as format from 'pedantic/format.js';
import * as lint from 'pedantic/lint.js';
import svg2c from 'svg2c/command.js';
import workspaces from 'ts-doctor/workspaces.js';
import Yargs from 'yargs';

function setCmdName(name, cmd) {
  return {
    ...cmd,
    command: cmd.command.replace(/^\$0/, name),
  };
}
const yargs = Yargs();

yargs
  .help()
  .alias('h', 'help')
  .version()
  .alias(`v`, `version`)
  .wrap(yargs.terminalWidth())
  .demandCommand(1, `Pass --help to see all available commands and options.`)
  .strict()
  .recommendCommands()
  .command(setCmdName('build', build))
  .command(setCmdName('start', start))
  .command(setCmdName('init', init))
  .command(setCmdName('release', rollout))
  .command(setCmdName('intl', intl))
  .command(setCmdName('icons', svg2c))
  .command(setCmdName('fixup-workspaces', workspaces))
  .command(setCmdName('format', format))
  .command(setCmdName('lint', lint))
  .parse(process.argv.slice(2));
