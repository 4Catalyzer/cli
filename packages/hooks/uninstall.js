const { uninstall } = require('./lib');

exports.command = '$0';

exports.describe = 'Uninstall hooks';

exports.handler = async () => {
  await uninstall();

  console.log("Hook'em hooks removed");
};
