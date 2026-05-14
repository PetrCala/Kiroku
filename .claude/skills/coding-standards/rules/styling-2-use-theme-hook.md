---
ruleId: STYLING-2
title: Use the useTheme hook, never import theme files directly
---

## [STYLING-2] Use the useTheme hook, never import theme files directly

### Reasoning

The app supports light and dark themes via a runtime context. Importing a specific theme file (e.g. `import lightTheme from '@styles/theme/themes/light'`) hard-codes one variant and breaks theme switching. The ESLint config already blocks direct imports of `@styles/theme`, `@styles/index`, and `@styles/utils` for this reason — components must consume the active theme through `useTheme()`, computed styles through `useThemeStyles()`, and style helpers through `useStyleUtils()`.

### Incorrect

```tsx
import lightTheme from '@styles/theme/themes/light';
import colors from '@styles/theme/colors';

function Card() {
  return (
    <View
      style={{
        backgroundColor: lightTheme.cardBG,
        borderColor: colors.productLight400,
      }}
    />
  );
}
```

### Correct

```tsx
import useTheme from '@hooks/useTheme';

function Card() {
  const theme = useTheme();
  return (
    <View style={{backgroundColor: theme.cardBG, borderColor: theme.border}} />
  );
}
```

---

### Review Metadata

Flag ONLY when ALL of these are true:

- A component or hook imports from `@styles/theme`, `@styles/theme/colors`, `@styles/theme/themes/light`, `@styles/theme/themes/dark`, `@styles/index`, or `@styles/utils`
- The file is not part of the theme system itself (`src/styles/theme/`, `src/styles/index.ts`, `src/styles/utils.ts`)

**DO NOT flag if:**

- The import is type-only (`import type {ThemeColors} from '@styles/theme/types'`) — typing references don't bind to a specific theme variant
- The file is the theme system itself defining or composing themes
- The file is a generated module or build script that doesn't run inside the React tree

**Search Patterns** (hints for reviewers):

- `from '@styles/theme'`
- `from '@styles/theme/themes/`
- `from '@styles/theme/colors'`
- `from '@styles/index'`
- `from '@styles/utils'`
