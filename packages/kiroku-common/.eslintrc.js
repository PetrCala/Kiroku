module.exports = {
  extends: ['../../.eslintrc.js'],
  // Point ESLint's TS parser at this package's tsconfig for type-aware rules
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  // Avoid linting built output and this config file in typed mode
  ignorePatterns: ['dist/**', '.eslintrc.js'],
};
