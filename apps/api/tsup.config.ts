import {defineConfig} from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  clean: true,
  tsconfig: 'tsconfig.json',
  alias: {
    '@kiroku/common': '../../packages/kiroku-common/src/index.ts',
    '@kiroku/common/*': '../../packages/kiroku-common/src/*',
  },
});

