import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import pedantic from '../lib.js';

describe('pedantic', () => {
  const cwd = resolve(dirname(fileURLToPath(import.meta.url)), './fixtures');
  it('should', async () => {
    await pedantic(['**/*.js'], { cwd });
  });
});
