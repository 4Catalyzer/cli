/* eslint-disable no-param-reassign */
import { promises as fs } from 'fs';
import { extname as _extname, basename, resolve } from 'path';

import { chalk } from '@4c/cli-core/ConsoleUtilities';
import babel from '@babel/core';
import { safeLoad } from 'js-yaml';
import camelCase from 'lodash/camelCase.js';
import upperFirst from 'lodash/upperFirst.js';
import Svgo from 'svgo';

import defaultConfig, {
  js2svg as _js2svg,
  plugins as _plugins,
} from './svgo.config.js';

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
    plugins: [..._plugins, ...config.plugins],
    js2svg: {
      ..._js2svg,
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

  const { code } = await babel.transformAsync(
    (await svgo.optimize(source)).data.trim(),
    {
      presets: [
        [require.resolve('@babel/preset-react'), { development: false }],
      ],
    },
  );

  return `/* eslint-disable */
/* prettier-ignore-start */
// [GENERATED FILE; DO NOT EDIT BY HAND]

${reactImport}

var element = ${code}

var Svg = React.forwardRef(function (props, ref) {
  var next = { ref: ref };
  for (var key in props) {
    if (props.hasOwnProperty(key)) {
      next[key] = props[key];
    }
  }
  return React.cloneElement(element, next);
});
Svg.displayName = "${displayName}";
Svg.element = element;
${exportName} Svg;
`;
}
