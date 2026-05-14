---
ruleId: STYLING-3
title: Pick the most specific semantic token for the role
---

## [STYLING-3] Pick the most specific semantic token for the role

### Reasoning

Theme tokens carry semantic meaning beyond color. Picking a generic token (`appColor`, `text`) when a role-specific one exists (`success`, `textError`) loses the intent and silently breaks when the design system changes one without the other. Pick the most specific token whose name matches the role of the surface being colored.

The canonical list of valid token names is the `ThemeColors` type in [`src/styles/theme/types.ts`](src/styles/theme/types.ts); active values are in [`src/styles/theme/themes/light.ts`](src/styles/theme/themes/light.ts) and [`src/styles/theme/themes/dark.ts`](src/styles/theme/themes/dark.ts). The table below covers the tokens that are easy to confuse — when in doubt, prefer the role-named token over the generic one.

### Incorrect

```tsx
function DestructiveButton() {
  const theme = useTheme();
  // appColor is the brand-yellow accent — wrong semantic for a destructive button
  return <Button style={{backgroundColor: theme.appColor}} title="Delete" />;
}
```

### Correct

```tsx
function DestructiveButton() {
  const theme = useTheme();
  return (
    <Button
      style={{backgroundColor: theme.danger}}
      hoverStyle={{backgroundColor: theme.dangerHover}}
      title="Delete"
    />
  );
}
```

#### Common disambiguations

| Use this                                      | Not this                    | When the role is                                                           |
| --------------------------------------------- | --------------------------- | -------------------------------------------------------------------------- |
| `success` / `successHover` / `successPressed` | `appColor`                  | Primary action button, positive confirmation                               |
| `danger` / `dangerHover` / `dangerPressed`    | `appColor`, `textError`     | Destructive button or banner (use `textError` only for inline form errors) |
| `warning`                                     | `danger`                    | Caution state — not an error                                               |
| `textError`                                   | `danger`                    | Inline form-validation message                                             |
| `link` / `linkHover`                          | `appColor`, `text`          | Inline hyperlink in body copy                                              |
| `cardBG`                                      | `appBG`                     | Surface of a card or tile                                                  |
| `modalBackground`                             | `appBG`                     | Surface of a modal or sheet                                                |
| `componentBG`                                 | `cardBG`                    | Inputs, list items, generic component surface                              |
| `appBG`                                       | `modalBackground`, `cardBG` | Full-screen page background                                                |
| `border`                                      | `borderFocus`               | Default 1px divider — `borderFocus` is for focus rings only                |
| `borderLighter`                               | `border`                    | Subtle divider inside a card                                               |
| `iconMenu`                                    | `icon`, `appLogo`           | Navigation menu icon (brand-tinted)                                        |
| `appLogo`                                     | `icon`, `iconMenu`          | Tint passed to `<KirokuLogo />` / brand mark                               |
| `textSupporting`                              | `text`                      | Helper / caption / less-important copy                                     |
| `textReversed`                                | `textDark`, `textLight`     | Text on a surface that flips theme                                         |
| `placeholderText`                             | `textSupporting`            | TextInput placeholder                                                      |
| `hoverComponentBG`                            | `buttonHoveredBG`           | Hover state on a non-button component                                      |
| `buttonHoveredBG`                             | `hoverComponentBG`          | Hover state on a default button                                            |
| `splashBG`                                    | `appBG`, `appColor`         | Splash screen background — not used inside the running app                 |

### Adding a new token

If no existing token fits, add a new semantic key:

1. Add the key to `ThemeColors` in [`src/styles/theme/types.ts`](src/styles/theme/types.ts).
2. Provide a value in **both** [`src/styles/theme/themes/light.ts`](src/styles/theme/themes/light.ts) and [`src/styles/theme/themes/dark.ts`](src/styles/theme/themes/dark.ts). Reference an existing palette entry from `colors.ts` — don't add a new raw hex unless the palette genuinely lacks the shade.

---

### Review Metadata

Flag ONLY when ALL of these are true:

- A theme token is used whose name does not match the visual role of the element (e.g. `appColor` on a primary submit button, `appColor` on a destructive button, `text` on an inline error, `danger` on a "caution" warning state)
- A role-specific token exists in `ThemeColors` that would match better

**DO NOT flag if:**

- The role genuinely is brand-accent / generic / undefined (e.g. `appColor` on a brand mascot or decorative element)
- The component is theme-experimental code or a prototype clearly marked as such
- The token chosen and the suggested alternative resolve to the same palette entry in both light and dark themes AND the existing code is internally consistent — token semantics still matter, but bulk-changing every call site is low-value

**Search Patterns** (hints for reviewers):

- `theme.appColor` in contexts that look like buttons, banners, or error states
- `theme.text` in contexts that look like form validation / error copy
- `theme.danger` outside destructive-action contexts
- `theme.appBG` inside modals, cards, or list items
