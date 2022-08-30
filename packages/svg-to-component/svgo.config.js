import camelCase from 'lodash/camelCase.js';

const SPECIAL_ATTRS = {
  class: 'className',
};

['rowSpan', 'colSpan', 'contentEditable', 'spellCheck'].forEach((name) => {
  SPECIAL_ATTRS[name.toLowerCase()] = name;
});

const camelCaseAttributes = {
  name: 'camelCaseAttributes',
  type: 'visitor',
  active: true,
  fn() {
    return {
      element: {
        enter: (node) => {
          for (const [name, attr] of Object.entries(node.attributes)) {
            if (name.match(/(aria|data)-.+/gi)) {
              continue;
            }

            let nextName =
              SPECIAL_ATTRS[name] ||
              name.replace(
                /^(xml|xlink|xmlns):(.+)$/i,
                (_, ns, n) => `${ns}-${n}`,
              );

            nextName = camelCase(nextName);

            if (nextName !== name) {
              delete node.attributes[name];
              node.attributes[nextName] = attr;
            }
          }
        },
      },
    };
  },
};

export const plugins = [
  {
    name: 'preset-default',
    params: {
      overrides: {
        removeViewBox: false,
      },
    },
  },
  'removeXMLNS',
  'removeComments',
  camelCaseAttributes,
];

export const js2svg = {
  pretty: true,
  indent: '  ',
};
