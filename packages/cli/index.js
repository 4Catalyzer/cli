#!/usr/bin/env node

const build = require('@4c/build/command');
const start = require('@4c/start/command');
const init = require('@4c/init/command');
const rollout = require('@4c/rollout/command');
const yargs = require('yargs');
const intl = require('@4c/intl/command');
const format = require('pedantic/format');
const lint = require('pedantic/lint');
const svg2c = require('svg2c/command');

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
  .command(setCmdName('build', build))
  .command(setCmdName('start', start))
  .command(setCmdName('init', init))
  .command(setCmdName('release', rollout))
  .command(setCmdName('intl', intl))
  .command(setCmdName('icons', svg2c))
  .command(format)
  .command(lint)
  .parse(process.argv.slice(2));
