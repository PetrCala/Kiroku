const path = require('path');

const restrictedImportPaths = [];
const restrictedImportPatterns = [];

module.exports = {
  extends: [
    'expensify',
    'airbnb-typescript',
    'plugin:storybook/recommended',
    'plugin:react-native-a11y/basic',
    'plugin:@dword-design/import-alias/recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:you-dont-need-lodash-underscore/all',
    'plugin:prettier/recommended',
  ],
  plugins: [
    '@typescript-eslint',
    'jsdoc',
    'you-dont-need-lodash-underscore',
    'react-native-a11y',
    'react',
    'testing-library',
    'eslint-plugin-react-compiler',
  ],
  ignorePatterns: [
    '/lib/**/*', // Ignore built files.
    '/generated/**/*', // Ignore generated files.
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: path.resolve(__dirname, './tsconfig.json'),
  },
  env: {
    es6: true,
    node: true,
  },
  globals: {
    __DEV__: 'readonly',
  },
  root: true,
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/prefer-enum-initializers': 'error',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-import-type-side-effects': 'error',
    '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: ['variable', 'property'],
        // Lower case is enabled because of Firebase naming conventions
        format: ['camelCase', 'UPPER_CASE', 'PascalCase', 'snake_case'],
      },
      {
        selector: 'function',
        format: ['camelCase', 'PascalCase'],
      },
      {
        selector: ['typeLike', 'enumMember'],
        format: ['PascalCase'],
      },
      {
        selector: ['parameter', 'method'],
        format: ['camelCase', 'PascalCase'],
        leadingUnderscore: 'allow',
      },
    ],
    '@typescript-eslint/ban-types': [
      'error',
      {
        types: {
          object: "Use 'Record<string, T>' instead.",
        },
        extendDefaults: true,
      },
    ],
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports',
      },
    ],
    '@typescript-eslint/consistent-type-exports': [
      'error',
      {
        fixMixedExportsWithInlineTypeSpecifier: false,
      },
    ],
    '@typescript-eslint/no-use-before-define': ['error', {functions: false}],

    // ESLint core rules
    'es/no-nullish-coalescing-operators': 'off',
    'es/no-optional-chaining': 'off',

    // Import specific rules
    'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
    'import/no-extraneous-dependencies': 'off',

    // Rulesdir specific rules
    'rulesdir/no-default-props': 'error',
    'rulesdir/prefer-type-fest': 'error',
    'rulesdir/no-multiple-onyx-in-file': 'off',
    'rulesdir/prefer-underscore-method': 'off',
    'rulesdir/prefer-import-module-contents': 'off',

    // Disallow usage of certain functions and imports
    'no-restricted-syntax': [
      'error',
      {
        selector: 'TSEnumDeclaration',
        message: "Please don't declare enums, use union types instead.",
      },
    ],
    'no-restricted-properties': [
      'error',
      {
        object: 'Image',
        property: 'getSize',
        message:
          'Usage of Image.getImage is restricted. Please use the `react-native-image-size`.',
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        paths: restrictedImportPaths,
        patterns: restrictedImportPatterns,
      },
    ],

    // Other rules
    curly: 'error',
    'you-dont-need-lodash-underscore/throttle': 'off',
    // The suggested alternative (structuredClone) is not supported in Hermes:https://github.com/facebook/hermes/issues/684
    'you-dont-need-lodash-underscore/clone-deep': 'off',
    'prefer-regex-literals': 'off',
    'valid-jsdoc': 'off',
    'jsdoc/no-types': 'error',
    '@lwc/lwc/no-async-await': 'off',
    '@dword-design/import-alias/prefer-alias': [
      'warn',
      {
        alias: {
          '@src': './src',
        },
      },
    ],
  },

  overrides: [
    // Enforces every Onyx type and its properties to have a comment explaining its purpose.
    {
      files: ['src/types/onyx/**/*.ts'],
      rules: {
        'jsdoc/require-jsdoc': [
          'error',
          {
            contexts: [
              'TSInterfaceDeclaration',
              'TSTypeAliasDeclaration',
              'TSPropertySignature',
            ],
          },
        ],
      },
    },

    // Remove once no JS files are left
    {
      files: ['*.js', '*.jsx'],
      extends: ['plugin:@typescript-eslint/disable-type-checked'],
      rules: {
        '@typescript-eslint/prefer-nullish-coalescing': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/unbound-method': 'off',
        'jsdoc/no-types': 'off',
        'react/jsx-filename-extension': 'off',
        'rulesdir/no-default-props': 'off',
      },
    },
  ],
};
