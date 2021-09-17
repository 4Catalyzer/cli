let resolve;
const ready = new Promise((y) => {
  resolve = y;
});

module.exports = async (...args) => {
  const plop = await import('./plopfile.js');

  plop.default(...args);
  resolve();
};

module.exports.ready = ready;
