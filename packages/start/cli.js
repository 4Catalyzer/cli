#!/usr/bin/env node

import createCliFromCommand from '@4c/cli-core/createCliFromCommand';

import * as Command from './command.js';

createCliFromCommand(Command);
