export default {
  plugins: [
    {
      name: 'addAttributesToSVGElement',
      params: {
        attributes: [{ fill: 'currentColor' }, { 'aria-hidden': true }],
      },
    },
  ],
};
