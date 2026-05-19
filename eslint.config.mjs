import {FlatCompat} from '@eslint/eslintrc';
import tsParser from '@typescript-eslint/parser';
import expensifyConfig from 'eslint-config-expensify';
import prettierConfig from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';
import react from 'eslint-plugin-react';
import reactCompiler from 'eslint-plugin-react-compiler';
import reactNativeA11Y from 'eslint-plugin-react-native-a11y';
import rulesdir from 'eslint-plugin-rulesdir';
import testingLibrary from 'eslint-plugin-testing-library';
import seatbelt from 'eslint-seatbelt';
import {defineConfig, globalIgnores} from 'eslint/config';
import globals from 'globals';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import typescriptEslint from 'typescript-eslint';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// `eslint-plugin-rulesdir` lets us load rules from arbitrary local directories.
// Point it at `eslint-config-expensify`'s shipped rules so configs that
// reference `rulesdir/<rule>` resolve them.
const require = createRequire(import.meta.url);
const expensifyConfigDirectory = path.dirname(
  require.resolve('eslint-config-expensify/package.json'),
);
rulesdir.RULES_DIR = [
  path.resolve(expensifyConfigDirectory, 'eslint-plugin-expensify'),
];

const restrictedImportPaths = [
  {
    name: 'react-native',
    importNames: [
      'useWindowDimensions',
      'StatusBar',
      'TouchableOpacity',
      'TouchableWithoutFeedback',
      'TouchableNativeFeedback',
      'TouchableHighlight',
      'Pressable',
      'Text',
      'ScrollView',
    ],
    message: [
      '',
      "For 'useWindowDimensions', please use '@src/hooks/useWindowDimensions' instead.",
      "For 'TouchableOpacity', 'TouchableWithoutFeedback', 'TouchableNativeFeedback', 'TouchableHighlight', 'Pressable', please use 'PressableWithFeedback' and/or 'PressableWithoutFeedback' from '@components/Pressable' instead.",
      "For 'StatusBar', please use '@libs/StatusBar' instead.",
      "For 'Text', please use '@components/Text' instead.",
      "For 'ScrollView', please use '@components/ScrollView' instead.",
    ].join('\n'),
  },
  {
    name: 'react-native-gesture-handler',
    importNames: [
      'TouchableOpacity',
      'TouchableWithoutFeedback',
      'TouchableNativeFeedback',
      'TouchableHighlight',
    ],
    message:
      "Please use 'PressableWithFeedback' and/or 'PressableWithoutFeedback' from '@components/Pressable' instead.",
  },
  {
    name: 'awesome-phonenumber',
    importNames: ['parsePhoneNumber'],
    message: "Please use '@libs/PhoneNumber' instead.",
  },
  {
    name: 'react-native-safe-area-context',
    importNames: [
      'useSafeAreaInsets',
      'SafeAreaConsumer',
      'SafeAreaInsetsContext',
    ],
    message:
      "Please use 'useSafeAreaInsets' from '@src/hooks/useSafeAreaInset' and/or 'SafeAreaConsumer' from '@components/SafeAreaConsumer' instead.",
  },
  {
    name: 'react',
    importNames: ['CSSProperties'],
    message:
      "Please use 'ViewStyle', 'TextStyle', 'ImageStyle' from 'react-native' instead.",
  },
  {
    name: '@styles/index',
    importNames: ['default', 'defaultStyles'],
    message:
      'Do not import styles directly. Please use the `useThemeStyles` hook instead.',
  },
  {
    name: '@styles/utils',
    importNames: ['default', 'DefaultStyleUtils'],
    message:
      'Do not import StyleUtils directly. Please use the `useStyleUtils` hook instead.',
  },
  {
    name: '@styles/theme',
    importNames: ['default', 'defaultTheme'],
    message:
      'Do not import themes directly. Please use the `useTheme` hook instead.',
  },
  {
    name: '@styles/theme/illustrations',
    message:
      'Do not import theme illustrations directly. Please use the `useThemeIllustrations` hook instead.',
  },
  {
    name: 'date-fns/locale',
    message:
      "Do not import 'date-fns/locale' directly. Please use the submodule import instead, like 'date-fns/locale/en-GB'.",
  },
  {
    name: 'expensify-common',
    importNames: ['Device', 'ExpensiMark'],
    message: [
      '',
      "For 'Device', do not import it directly, it's known to make VSCode's IntelliSense crash. Please import the desired module from `expensify-common/dist/Device` instead.",
      "For 'ExpensiMark', please use '@libs/Parser' instead.",
    ].join('\n'),
  },
  {
    name: 'lodash/memoize',
    message: "Please use '@src/libs/memoize' instead.",
  },
  {
    name: 'lodash',
    importNames: ['memoize'],
    message: "Please use '@src/libs/memoize' instead.",
  },
];

const restrictedImportPatterns = [
  {
    group: ['**/assets/animations/**/*.json'],
    message:
      "Do not import animations directly. Please use the '@components/LottieAnimations' import instead.",
  },
  {
    group: ['@styles/theme/themes/**'],
    message:
      'Do not import themes directly. Please use the `useTheme` hook instead.',
  },
  {
    group: [
      '@styles/utils/**',
      '!@styles/utils/FontUtils',
      '!@styles/utils/types',
    ],
    message:
      'Do not import style util functions directly. Please use the `useStyleUtils` hook instead.',
  },
  {
    group: ['@styles/theme/illustrations/themes/**'],
    message:
      'Do not import theme illustrations directly. Please use the `useThemeIllustrations` hook instead.',
  },
];

export default defineConfig([
  // Flat config defaults `reportUnusedDisableDirectives` to 'error', which
  // surfaces hundreds of stale `// eslint-disable-next-line <rule>` comments
  // referencing rules that no longer exist (e.g. `@typescript-eslint/ban-types`,
  // `@typescript-eslint/no-empty-interface`). Demote to 'warn' so eslint-seatbelt
  // can baseline them as warnings and we clean them up gradually.
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
  },

  expensifyConfig,
  typescriptEslint.configs.recommendedTypeChecked,
  typescriptEslint.configs.stylisticTypeChecked,

  // eslint-seatbelt: reclassify grandfathered violations as warnings using a
  // checked-in TSV baseline (`eslint.seatbelt.tsv`).
  {
    settings: {
      seatbelt: {
        seatbeltFile: path.join(dirname, 'eslint.seatbelt.tsv'),
        threadsafe: true,
        // Never persist TSV updates locally; CI handles tightening separately.
        readOnly: !process.env.CI,
      },
    },
    plugins: {
      'eslint-seatbelt': seatbelt,
    },
    rules: {
      'eslint-seatbelt/configure': 'error',
    },
    processor: seatbelt.processors.seatbelt,
  },

  // Main TS/TSX/JS/JSX rules block.
  {
    extends: new FlatCompat({baseDirectory: dirname}).extends(
      'airbnb-typescript',
      'plugin:react-native-a11y/basic',
      'plugin:@dword-design/import-alias/recommended',
      'plugin:you-dont-need-lodash-underscore/all',
    ),

    plugins: {
      jsdoc,
      react,
      'react-compiler': reactCompiler,
      'react-native-a11y': reactNativeA11Y,
      'testing-library': testingLibrary,
    },

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: path.resolve(dirname, './tsconfig.json'),
        tsconfigRootDir: dirname,
      },
      globals: {
        ...globals.jest,
        __DEV__: 'readonly',
      },
    },

    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.mjs',
      '**/*.cjs',
    ],
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
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            object: "Use 'Record<string, T>' instead.",
          },
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

      // React and React Native specific rules
      'react-native-a11y/has-accessibility-hint': ['off'],
      'react/require-default-props': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-constructed-context-values': 'error',
      'react-native-a11y/has-valid-accessibility-descriptors': [
        'error',
        {
          touchables: ['PressableWithoutFeedback', 'PressableWithFeedback'],
        },
      ],
      'react-compiler/react-compiler': 'error',

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
      // The suggested alternative (structuredClone) is not supported in Hermes: https://github.com/facebook/hermes/issues/684
      'you-dont-need-lodash-underscore/clone-deep': 'off',
      'prefer-regex-literals': 'off',
      'valid-jsdoc': 'off',
      'jsdoc/no-types': 'error',
      '@lwc/lwc/no-async-await': 'off',
      '@dword-design/import-alias/prefer-alias': [
        'warn',
        {
          alias: {
            '@assets': './assets',
            '@components': './src/components',
            '@hooks': './src/hooks',
            '@firebase/auth': [
              './node_modules/@firebase/auth/dist/index.rn.d.ts',
            ],
            // This is needed up here, if not @libs/actions would take the priority
            '@userActions': './src/libs/actions',
            '@libs': './src/libs',
            '@navigation': './src/libs/Navigation',
            '@pages': './src/pages',
            '@styles': './src/styles',
            // This path provides aliases for files like `ONYXKEYS` and `CONST`.
            '@src': './src',
            '@desktop': './desktop',
            '@github': './.github',
          },
        },
      ],
    },
  },

  // Enforce every Onyx type and its properties to have a JSDoc comment.
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

  // JS/JSX files: disable type-checked rules (no TS project to consult).
  {
    files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
    ...typescriptEslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'jsdoc/no-types': 'off',
      'react/jsx-filename-extension': 'off',
      'rulesdir/no-default-props': 'off',
    },
  },

  // typescript-eslint v8 dropped its formatting/stylistic rules (they moved to
  // `@stylistic/eslint-plugin`). `eslint-config-airbnb-typescript` still references
  // the old `@typescript-eslint/*` names, so ESLint v9 errors out on config load
  // until we explicitly turn them off. Prettier handles formatting anyway.
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.mjs',
      '**/*.cjs',
    ],
    rules: {
      '@typescript-eslint/brace-style': 'off',
      '@typescript-eslint/comma-dangle': 'off',
      '@typescript-eslint/comma-spacing': 'off',
      '@typescript-eslint/func-call-spacing': 'off',
      '@typescript-eslint/indent': 'off',
      '@typescript-eslint/keyword-spacing': 'off',
      '@typescript-eslint/lines-between-class-members': 'off',
      '@typescript-eslint/no-extra-semi': 'off',
      '@typescript-eslint/no-throw-literal': 'off',
      '@typescript-eslint/object-curly-spacing': 'off',
      '@typescript-eslint/padding-line-between-statements': 'off',
      '@typescript-eslint/quotes': 'off',
      '@typescript-eslint/semi': 'off',
      '@typescript-eslint/space-before-blocks': 'off',
      '@typescript-eslint/space-before-function-paren': 'off',
      '@typescript-eslint/space-infix-ops': 'off',
    },
  },

  // Rule prunes triggered by the ESLint v9 / eslint-config-expensify v3 upgrade.
  // Each block below is a deliberate decision to drop rules that either
  // (a) Expensify themselves turned off in their flat config, (b) come from a
  // plugin Kiroku never used, or (c) reflect opinionated Expensify-product
  // preferences that don't match Kiroku's style. See PR description for the
  // numbers and rationale.
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.mjs',
      '**/*.cjs',
    ],
    rules: {
      // === Tier 1: mirror Expensify's TS-only off block ===
      // The jsdoc plugin enforces declarations that aren't useful for TS code
      // — TS already documents param names and types. Expensify drops these.
      'jsdoc/require-param': 'off',
      'jsdoc/require-param-type': 'off',
      'jsdoc/check-param-names': 'off',
      'jsdoc/check-tag-names': 'off',
      'jsdoc/check-types': 'off',

      // typescript-eslint v8 enabled these via recommendedTypeChecked /
      // stylisticTypeChecked. They produce a lot of noise on legitimate code
      // patterns (e.g. `.indexOf(x) !== -1` instead of `.includes(x)`).
      // Expensify turns them off.
      '@typescript-eslint/prefer-find': 'off',
      '@typescript-eslint/prefer-includes': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/prefer-regexp-exec': 'off',
      '@typescript-eslint/no-require-imports': 'off',

      // @typescript-eslint/prefer-promise-reject-errors is duplicated by the
      // base `prefer-promise-reject-errors` rule; keep one. Expensify keeps
      // the base rule.
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      'prefer-promise-reject-errors': 'error',

      // === Tier 2: drop unicorn entirely ===
      // `eslint-config-expensify` v3 transitively pulls in eslint-plugin-unicorn
      // and enables 5 rules. Kiroku never used unicorn; adopting it is its own
      // decision, not a side-effect of the ESLint upgrade.
      'unicorn/no-array-for-each': 'off',
      'unicorn/prefer-array-find': 'off',
      'unicorn/prefer-set-has': 'off',
      'unicorn/prefer-set-size': 'off',
      'unicorn/prefer-string-replace-all': 'off',

      // === Tier 3: drop opinionated rulesdir rules Kiroku didn't ask for ===
      // These are Expensify-product style preferences shipped via
      // `eslint-config-expensify`. We keep the ones with clear Kiroku value
      // (onyx-connect bans, narrow-hook-dependencies, useState initializers,
      // context-provider-split-values, no-deep-equal-in-memo) but drop the
      // pure-style ones.
      'rulesdir/prefer-early-return': 'off',
      'rulesdir/use-double-negation-instead-of-boolean': 'off',
      'rulesdir/no-acc-spread-in-reduce': 'off',
      'rulesdir/no-negated-variables': 'off',
    },
  },

  // Disable formatting rules that conflict with Prettier. Must be last.
  prettierConfig,

  globalIgnores([
    'lib/**',
    'src/libs/common/**',
    'local/**',
    'node_modules/**',
    '.claude/**',
    'android/**',
    'ios/Pods/**',
    'ios/build/**',
    'web-build/**',
    'docs/vendor/**',
  ]),
]);
