const path = require('path');
const pedantic = require('../lib');

describe('pedantic', () => {
  const cwd = path.resolve(__dirname, './fixtures');
  it('should', async () => {
    await pedantic(['**/*.js'], { cwd });
  });
});
