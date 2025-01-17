module.exports = {
  root: true,
  extends: '@dooboo/eslint-config',
  rules: {
    'eslint-comments/no-unlimited-disable': 0,
    'eslint-comments/no-unused-disable': 0,
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto',
      },
    ],
  },
  globals: {
    context: 'readonly',
  },
};
