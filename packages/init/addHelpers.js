export default (plop) => {
  plop.setHelper('eq', (a, b) => a === b);
  plop.setHelper('neq', (a, b) => a !== b);

  plop.setHelper('iff', (a, b, c) => (a ? b : c));

  plop.setHelper('year', () => new Date().getFullYear());
};
