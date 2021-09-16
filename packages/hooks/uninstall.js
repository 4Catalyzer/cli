import { uninstall } from './lib.js';

export const command = '$0';

export const describe = 'Uninstall hooks';

export async function handler() {
  await uninstall();

  console.log("Hook'em hooks removed");
}
