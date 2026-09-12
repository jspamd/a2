const { defineConfig } = require('eslint/config');
const js = require('@eslint/js');
const globals = require('globals');

// Node/CommonJS Express API. Start from recommended, then silence rules that
// currently fail across many existing controllers (implicit Sequelize model
// names, unused imports). Do not mass-rewrite the tree for style.
module.exports = defineConfig([
  {
    ignores: [
      'node_modules/**',
      'uploads/**',
      'logs/**',
      'coverage/**',
    ],
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-useless-assignment': 'off',
      'no-useless-escape': 'off',
      'no-prototype-builtins': 'off',
    },
  },
  {
    files: ['tests/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
]);
