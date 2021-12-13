/* eslint-disable no-param-reassign */
import { promises as fs } from 'fs';
import { extname as _extname, basename, resolve } from 'path';

import { chalk } from '@4c/cli-core/ConsoleUtilities';
import { safeLoad } from 'js-yaml';
import camelCase from 'lodash/camelCase.js';
import upperFirst from 'lodash/upperFirst.js';
import sucrase from 'sucrase';
import Svgo from 'svgo';

import * as defaultConfig from './svgo.config.js';

// https://github.com/svg/svgo/blob/fe0ecaf31eb87a913638a62f842044e425683623/lib/svgo/coa.js
async function loadConfig(config) {
  let configData;

  if (config.startsWith('{')) {
    try {
      return JSON.parse(config);
    } catch (e) {
      throw new Error(
        chalk.red(`Error: Couldn't parse config JSON.\n${String(e)}`),
      );
    }
  }
  const configPath = resolve(config);

  try {
    configData = JSON.parse(await fs.readFile(configPath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        chalk.red(`Error: couldn't find config file '${config}'.`),
      );
    }
    if (err.code === 'EISDIR') {
      throw new Error(
        chalk.red(`Error: directory '${config}' is not a config file.`),
      );
    }

    configData = safeLoad(configData);

    if (!configData || Array.isArray(configData)) {
      throw new Error(chalk.red(`Error: invalid config file '${config}'.`));
    }
  }
  return configData;
}

const RESOLVED = Symbol('svg2c resolved config');

export async function getConfig(externalConfig) {
  if (!externalConfig) return defaultConfig;

  const config =
    typeof externalConfig === 'object'
      ? externalConfig
      : await loadConfig(externalConfig);

  if (externalConfig[RESOLVED]) {
    return externalConfig;
  }

  return {
    [RESOLVED]: true,
    ...defaultConfig,
    ...config,
    plugins: [...defaultConfig.plugins, ...config.plugins],
    js2svg: {
      ...defaultConfig.js2svg,
      ...config.js2svg,
    },
  };
}

export default async function svg2c(source, { esModules, filename, config }) {
  const extname = _extname(filename);
  const svgoConfig = await getConfig(config);

  const svgo = new Svgo(svgoConfig);

  const displayName = upperFirst(camelCase(basename(filename, extname)));

  const reactImport = esModules
    ? 'import React from "react"'
    : 'var React = require("react");';

  const exportName = esModules ? 'export default' : 'module.exports =';

  const { code } = sucrase.transform(
    (await svgo.optimize(source)).data.trim(),
    { transforms: ['jsx'], production: true },
  );

  return `/* eslint-disable */
/* prettier-ignore-start */
// [GENERATED FILE; DO NOT EDIT BY HAND]

${reactImport}

var element = ${code}

var Svg = React.forwardRef((props, ref) => React.cloneElement(element, { ref, ...props }));
Svg.displayName = "${displayName}";
Svg.element = element;
${exportName} Svg;
`;
}
