#!/usr/bin/env node

const yargs = require('yargs');

yargs
  .help()
  .alias('h', 'help')
  .version()
  .alias(`v`, `version`)
  .wrap(yargs.terminalWidth())
  .strict()
  .command(require('./format'))
  .command(require('./lint'))
  .parse(process.argv.slice(2));
