---
ruleId: STYLING-1
title: No raw hex codes in components
---

## [STYLING-1] No raw hex codes in components

### Reasoning

Raw hex literals in components bypass the theme system, which means they don't respect dark mode, can't be re-skinned for white-label builds, and silently drift apart from the brand palette. All colors must come from a semantic theme token accessed via `useTheme()`. The only files allowed to contain raw hex are the palette and theme-mapping files in `src/styles/theme/`.

### Incorrect

```tsx
function ErrorBanner() {
  return <View style={{backgroundColor: '#FF4949'}} />;
}
```

### Correct

```tsx
import useTheme from '@hooks/useTheme';

function ErrorBanner() {
  const theme = useTheme();
  return <View style={{backgroundColor: theme.danger}} />;
}
```

---

### Review Metadata

Flag ONLY when ALL of these are true:

- A hex color literal (`#RRGGBB` or `#RRGGBBAA`) appears in a file outside `src/styles/theme/`
- The hex is used as a color value (not as a hash anchor, ID, or unrelated string)
- The file is not a generated or deprecated module flagged for removal

**DO NOT flag if:**

- The hex appears in `src/styles/theme/colors.ts`, `src/styles/theme/themes/`, or `src/styles/theme/types.ts` — these are the legitimate palette and theme definitions
- The hex appears in test fixtures or storybook stories where a hard-coded reference value is intentional
- The hex appears in `commonStyles.ts` or another file the codebase has explicitly marked as deprecated; legacy violations are grandfathered, but new code must not add to them

**Search Patterns** (hints for reviewers):

- `#[0-9a-fA-F]{3,8}` inside files under `src/` but outside `src/styles/theme/`
- `backgroundColor:`, `color:`, `borderColor:`, `tintColor:`, `fill:` followed by a string literal
