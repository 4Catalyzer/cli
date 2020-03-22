// A fork of the built in formatter that is more intelligent

function isRelative(module) {
  return module.startsWith('./') || module.startsWith('../');
}

function formatFileList(files) {
  const { length } = files;
  if (!length) return '';
  return ` in ${files[0]}${files[1] ? `, ${files[1]}` : ''}${
    length > 2 ? ` and ${length - 2} other${length === 3 ? '' : 's'}` : ''
  }`;
}

function formatGroup(group) {
  const files = group.errors.map((e) => e.file).filter(Boolean);
  return `* ${group.module}${formatFileList(files)}`;
}

function dependenciesNotFound(dependencies) {
  if (dependencies.length === 0) return undefined;

  return [
    dependencies.length === 1
      ? 'This dependency was not found:'
      : 'These dependencies were not found:',
    '',
    ...dependencies.map(formatGroup),
  ].join('\n');
}

function relativeModulesNotFound(modules) {
  if (modules.length === 0) return undefined;

  return [
    modules.length === 1
      ? 'This relative module was not found:'
      : 'These relative modules were not found:',
    '',
    ...modules.map(formatGroup),
  ];
}

function formatModuleNotFound(allErrors) {
  const errors = allErrors.filter((e) => e.type === 'module-not-found');

  if (errors.length === 0) {
    return [];
  }

  const missingModule = new Map();

  errors.forEach((error) => {
    if (!missingModule.has(error.module)) {
      missingModule.set(error.module, []);
    }
    missingModule.get(error.module).push(error);
  });

  const groups = Array.from(missingModule.keys()).map((module) => ({
    module,
    relative: isRelative(module),
    errors: missingModule.get(module),
  }));

  const dependencies = groups.filter((group) => !group.relative);
  const relativeModules = groups.filter((group) => group.relative);

  const errs = [
    ...dependenciesNotFound(dependencies),
    ...(dependencies.length && relativeModules.length ? ['', ''] : undefined),
    ...relativeModulesNotFound(relativeModules),
  ];

  return errs;
}

module.exports = formatModuleNotFound;
