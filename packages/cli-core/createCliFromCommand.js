import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export default (
  { command, describe, handler, builder },
  argv = process.argv,
) => {
  const yargsInst = yargs(hideBin(argv));
  return yargsInst
    .help()
    .alias('h', 'help')
    .version()
    .alias(`v`, `version`)
    .wrap(yargsInst.terminalWidth())
    .strict()
    .command(command, describe, builder, handler).argv;
};
