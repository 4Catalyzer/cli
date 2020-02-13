/* eslint-disable no-param-reassign */
const { promises: fs } = require('fs');
const path = require('path');

const { chalk } = require('@4c/cli-core/ConsoleUtilities');
const { transformAsync } = require('@babel/core');
const yaml = require('js-yaml');
const camelCase = require('lodash/camelCase');
const upperFirst = require('lodash/upperFirst');
const Svgo = require('svgo');

const defaultConfig = require('./svgo.config.js');

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
  const configPath = path.resolve(config);

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

    configData = yaml.safeLoad(configData);

    if (!configData || Array.isArray(configData)) {
      throw new Error(chalk.red(`Error: invalid config file '${config}'.`));
    }
  }
  return configData;
}

const RESOLVED = Symbol('svg2c resolved config');

async function getConfig(externalConfig) {
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

module.exports = async function svg2c(
  source,
  { esModules, filename, config },
) {
  const extname = path.extname(filename);
  const svgoConfig = await getConfig(config);

  const svgo = new Svgo(svgoConfig);

  const displayName = upperFirst(camelCase(path.basename(filename, extname)));

  const reactImport = esModules
    ? 'import React from "react"'
    : 'var React = require("react");';

  const exportName = esModules ? 'export default' : 'module.exports =';

  const { code } = await transformAsync(
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
};

module.exports.getConfig = getConfig;
