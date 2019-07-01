const camelCase = require('lodash/camelCase');

const SPECIAL_ATTRS = {
  class: 'className',
};

['rowSpan', 'colSpan', 'contentEditable', 'spellCheck'].forEach(name => {
  SPECIAL_ATTRS[name] = name.toLowerCase();
});

const camelCaseAttributes = {
  type: 'perItem',
  active: true,
  fn(item) {
    if (!item.isElem()) return;

    item.eachAttr(attr => {
      if (attr.name.match(/(aria|data)-.+/gi)) return;

      let name =
        SPECIAL_ATTRS[attr.name] ||
        attr.name.replace(
          /^(xml|xlink|xmlns):(.+)$/i,
          (_, ns, n) => `${ns}-${n}`,
        );

      name = camelCase(name);

      if (name !== attr.name) {
        item.removeAttr(attr.name);
        item.addAttr({ ...attr, name });
      }
    });
  },
};

module.exports = {
  plugins: [
    { removeViewBox: false },
    { removeXMLNS: true },
    { removeComments: true },
    { camelCaseAttributes },
  ],
  js2svg: {
    pretty: true,
    indent: '  ',
  },
};
