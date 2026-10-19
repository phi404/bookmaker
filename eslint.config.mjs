export default [
  { ignores: ['node_modules/**', '.cache/**', 'dist/**', 'public/vendor/**', 'output/**', 'test-results/**', 'playwright-report/**', 'sources/**'] },
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest', sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error', 'no-unreachable': 'error', 'no-constant-condition': 'error',
      'no-duplicate-imports': 'error', 'no-eval': 'error', 'eqeqeq': ['error', 'always'],
    },
  },
  {
    files: ['src/ui/**/*.js', 'src/render/**/*.js', 'src/io/**/*.js'],
    languageOptions: { globals: { window: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly', indexedDB: 'readonly', fetch: 'readonly', Blob: 'readonly', FileReader: 'readonly', Worker: 'readonly' } },
  },
  {
    files: ['tests/e2e/**/*.mjs'],
    languageOptions: { globals: { document: 'readonly', Event: 'readonly' } },
  },
];
