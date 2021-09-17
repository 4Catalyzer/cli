#!/usr/bin/env node

import Yargs from 'yargs';

import format from './format.js';
import lint from './lint.js';

const yargs = Yargs(process.argv.slice(2));

yargs
  .alias('h', 'help')
  .version()
  .alias(`v`, `version`)
  .wrap(yargs.terminalWidth())
  .strict()
  .command(format)
  .command(lint)
  .parse(process.argv.slice(2));
