const { install } = require('./lib');

exports.command = '$0';

exports.describe = 'Install hooks';

exports.handler = async () => {
  const installed = await install();

  if (installed) {
    console.log("Hook'em hooks created");
  }
};
