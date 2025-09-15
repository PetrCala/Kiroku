module.exports = {
  extends: ['eslint-config-kiroku'],
  parserOptions: {
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['dist/**', '.eslintrc.js'],
};
