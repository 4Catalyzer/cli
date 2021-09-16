module.exports = {
  extends: ['4catalyzer', 'prettier'],
  plugins: ['prettier'],
  rules: {
    'global-require': 'off',
    'no-console': 'off',
    'import/no-dynamic-require': 'off',
    'prettier/prettier': 'error',
  },
  overrides: [
    {
      files: ['**/packages/{start,build,pedantic,cli}/**'],
      rules: {
        'import/extensions': ['error', 'ignorePackages'],
      },
    },
    {
      files: ['**/__tests__/**', '**/tests/**'],
      plugins: ['jest'],
      env: {
        jest: true,
      },
      rules: {
        'no-await-in-loop': 'off',
        'jest/no-disabled-tests': 'warn',
        'jest/no-focused-tests': 'error',
        'jest/no-identical-title': 'error',
        'jest/prefer-to-have-length': 'warn',
        'jest/valid-expect': 'error',
      },
    },
  ],
};
