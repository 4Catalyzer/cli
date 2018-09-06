const path = require('path');

const templatePath = path.resolve(__dirname, './templates');

// my own convention of naming scoped repo's like 4c-foo on disk
const getPackageNameFromPath = (scope, outDir) => {
  let name = path.basename(outDir);

  if (!scope) return name;
  name = name.replace(new RegExp(`^${scope.slice(1)}-`), '');
  return `${scope}/${name}`;
};

module.exports = {
  getPackageNameFromPath,
  templatePath,
};
