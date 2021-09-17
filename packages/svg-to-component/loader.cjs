module.exports = function svg2cLoader(content) {
  const cb = this.async();
  const { config, esmodules } = this.query;

  if (typeof config === 'string' && !config.startsWith('{')) {
    this.addDependency(config);
  }

  const run = async () => {
    const code = await import('./lib.js').then((m) =>
      m.default(content, {
        config,
        esmodules,
        filename: this.resourcePath,
      }),
    );

    return code;
  };

  run().then((result) => cb(null, result), cb);
};
