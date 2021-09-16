import { install } from './lib.js';

export const command = '$0';

export const describe = 'Install hooks';

export async function handler() {
  const installed = await install();

  if (installed) {
    console.log("Hook'em hooks created");
  }
}
