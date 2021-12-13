/* eslint-disable no-param-reassign */

import { extname as _extname, basename } from 'path';

import camelCase from 'lodash/camelCase.js';
import upperFirst from 'lodash/upperFirst.js';
import sucrase from 'sucrase';
import Svgo from 'svgo';

import * as defaultConfig from './svgo.config.js';

const RESOLVED = Symbol('svg2c resolved config');

export async function getConfig(externalConfig) {
  if (!externalConfig) {
    return defaultConfig;
  }

  const config =
    typeof externalConfig === 'object'
      ? externalConfig
      : await Svgo.loadConfig(externalConfig);

  if (externalConfig[RESOLVED]) {
    return externalConfig;
  }

  return {
    [RESOLVED]: true,
    ...defaultConfig,
    ...config,
    // maintain back compat for extending configs in "full mode" by not including default plugins
    plugins: config.full
      ? [...defaultConfig.plugins, ...config.plugins]
      : [...defaultConfig.plugins, ...config.plugins],
    js2svg: {
      ...defaultConfig.js2svg,
      ...config.js2svg,
    },
  };
}

export default async function svg2c(source, { esModules, filename, config }) {
  const extname = _extname(filename);
  const svgoConfig = await getConfig(config);
  const displayName = upperFirst(camelCase(basename(filename, extname)));

  const reactImport = esModules
    ? 'import React from "react"'
    : 'var React = require("react");';

  const exportName = esModules ? 'export default' : 'module.exports =';
  const svg = Svgo.optimize(source, svgoConfig).data.trim();

  const { code } = sucrase.transform(svg, {
    transforms: ['jsx'],
    production: true,
  });

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
