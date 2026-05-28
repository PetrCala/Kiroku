---
name: translate
description: Translate Kiroku UI strings into supported non-English locales using each language's curated glossary/style guide. Use whenever translation files (src/languages/*.ts) need new keys filled in, missing translations backfilled, or an existing language re-harmonized for consistency. Trigger on phrasing like "translate the new strings", "add Czech translations", "fill missing translations", "fix translation inconsistencies", or "audit the cs_cz file".
---

# Translate

The single sanctioned way to produce or fix non-English translations in Kiroku.
Translations are NOT hand-written ad hoc per feature — they are generated here
so every string honors the same glossary, register, and conventions. This is
what keeps terminology unified across the whole app and across future languages.

## Architecture

- **`src/languages/en.ts`** is the source of truth. Every other language mirrors
  its exact key structure (enforced at compile time via `TranslationPaths`).
- **`src/languages/context/<locale>.md`** is each language's glossary + style
  guide (terminology, register/tone, do-not-translate, capitalization,
  pluralization, formatting). When a string conflicts with its guide, the guide
  wins — fix the string.
- **`src/languages/<locale>.ts`** is the translation file you edit.
- **`src/languages/params.ts`** holds the parameter types for interpolated
  (function) strings. Keep it in sync when adding function-based keys.
- Supported locales live in `CONST.LOCALES` (currently `en`, `cs_cz`).

## When invoked, first decide the mode

- **`fill`** — translate only keys that are missing or changed in the target
  language vs. `en.ts`. This is the common case (a feature added English keys;
  fill the other languages). Default to this unless told otherwise.
- **`audit`** — re-translate / re-harmonize an entire language against its
  glossary to remove existing fragmentation. Use when the user asks to clean up,
  unify, or fix consistency, or after the glossary's "Decisions" change.

If the user named a language, target it. If not, target every non-English locale
in `CONST.LOCALES`.

## Procedure

1. **Load the glossary.** Read `src/languages/context/<locale>.md` in full.
   - If it does not exist, STOP and tell the user: a language must have a
     context file before it can be translated. Offer to bootstrap one from
     `_TEMPLATE.md` by mining the existing translation file.
2. **Find the work.**
   - `fill`: diff the target's keys against `en.ts`. Keys present in `en.ts` but
     missing in the target need translating. Keys whose English value changed
     since the last translation should be reviewed. Use `git log`/`git diff` on
     `en.ts` and the target file to find recently added/changed keys, or compare
     the flattened key sets.
   - `audit`: review every string in the target against the glossary, paying
     special attention to the "Known inconsistencies" backlog in the guide.
3. **Translate, honoring the guide.** For each string:
   - Use the canonical glossary term; never a "Do NOT use" variant.
   - Match the register/tone (e.g. Czech vykání) and capitalization (sentence
     vs title case).
   - Keep "do-not-translate" tokens verbatim.
   - Preserve interpolation: `${var}` placeholders, `Str.pluralize(...)` calls,
     and the exact function signature/param type from `en.ts`. Translate only
     the literal text, never the variable names or structure.
   - Apply formatting conventions (e.g. space before `%`, ellipsis character).
4. **Keep structure identical to `en.ts`.** Same nesting, same key order, same
   value shape (string → string, array → array of equal length, function →
   function with the same params). A key must never be silently dropped.
5. **Sync `params.ts`** if you added function-based keys that reference a param
   type the target file imports.
6. **Update the guide.** If you settled a term that wasn't in the glossary, add
   it. If `audit` fixed a backlog item, remove it from "Known inconsistencies".
7. **Verify** (see below).

## Verification (always run before reporting done)

```bash
# Key parity + value shape: the source-of-truth test for translations
npm run test -- __tests__/unit/Translate.test.ts

# Types (fast): catches a translation whose shape diverges from en.ts
npm run typecheck-tsgo
```

Then run Prettier on every file you changed (the PostToolUse hook also does this
on Edit/Write, but confirm): `npx prettier --write src/languages/<locale>.ts`.

## Guardrails

- Do NOT edit `en.ts` to make a translation fit. English is the source of truth.
- Do NOT translate inside a feature PR by hand — that is exactly the
  fragmentation this skill exists to prevent. Add English keys in the feature
  PR; fill other languages via this skill (see CLAUDE.md).
- Do NOT guess at a language you cannot translate accurately. If unsure of a
  term, flag it for the user rather than inventing one.
- When a glossary "Decision" is unresolved and materially affects wording, ask
  the user rather than silently picking.

## Adding a new language

1. Copy `src/languages/context/_TEMPLATE.md` → `src/languages/context/<locale>.md`
   and fill every section.
2. Add the locale to `CONST.LOCALES` and `src/languages/translations.ts`.
3. Run this skill in `fill` mode to generate `src/languages/<locale>.ts`.
4. Curate the glossary "Decisions", then verify.
