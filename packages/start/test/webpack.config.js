// process.traceDeprecation = true;

// eslint-disable-next-line import/no-extraneous-dependencies
const { rules, plugins } = require('webpack-atoms');

module.exports = {
  devtool: 'inline-source-map',
  entry: './index.js',
  output: { path: __dirname },
  module: {
    rules: [
      rules.js({
        presets: ['@babel/preset-typescript'],
      }),
    ],
  },
  plugins: [plugins.html()],
};
