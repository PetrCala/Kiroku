# <Language> (<locale_code>) translation guide

> Locale: `<locale_code>` · Language: `<Language>` · Source of truth: `src/languages/en.ts`
>
> Authoritative context for every `<locale_code>` translation in Kiroku. The
> `translate` skill and the CI translation reviewer both read this file. When a
> term, tone, or convention here conflicts with an existing string, **this guide
> wins** — the string is the bug, not the guide.

<!--
HOW TO ADD A NEW LANGUAGE
1. Copy this file to `<locale_code>.md` (the locale code must match a value in
   CONST.LOCALES, e.g. `de_de`, `es_es`).
2. Fill in every section below. Leave nothing as a placeholder — empty sections
   are how fragmentation creeps back in.
3. Add the locale to CONST.LOCALES and to src/languages/translations.ts.
4. Run the `translate` skill in `fill` mode to generate the initial file from
   en.ts using this guide.
5. Curate the auto-generated glossary decisions, then commit.
-->

## How to use this file

- **Adding/changing strings?** Match the glossary, register, and conventions
  below. Never invent a new word for a term that already has a canonical
  translation.
- **Found a term not covered here?** Pick the most consistent option, then add
  it to the glossary so the next translation matches.
- **Disagree with a decision?** Change it here first, then run the `translate`
  skill in `audit` mode to propagate.

## Decisions (confirm with the product owner)

Contested choices for this language. List the default the glossary enforces and
the alternative, so the choice is explicit and reviewable.

| Topic                       | Default | Alternative | Notes |
| --------------------------- | ------- | ----------- | ----- |
| <e.g. word for "drink">     |         |             |       |
| <e.g. register / formality> |         |             |       |

## Register & tone

- How do we address the user? (formal vs informal, and the language's specific
  grammatical form for it)
- Button / short-action verb style.
- Full-sentence CTA / link style.
- Overall voice (friendly, neutral, …) and anything to avoid.
- Gendered-agreement convention when the subject's gender is unknown.

## Glossary (canonical terms)

Cover at minimum the product's core domain vocabulary. Add a "Do NOT use" column
for terms that were historically translated inconsistently.

| English                               | <Language> (canonical) | Do NOT use |
| ------------------------------------- | ---------------------- | ---------- |
| session                               |                        |            |
| drinking session                      |                        |            |
| unit / units                          |                        |            |
| drink / drinks                        |                        |            |
| beer / wine / cocktail / shot / other |                        |            |
| statistics                            |                        |            |
| calendar                              |                        |            |
| profile                               |                        |            |
| friend / friends                      |                        |            |
| supporter                             |                        |            |
| sober / alcohol-free day              |                        |            |
| blackout                              |                        |            |

## Do-not-translate (keep verbatim)

Brand names, platform names, and any string that must stay in English (e.g.
`Kiroku`, `OK`, `App Store`, dev-only strings).

## Capitalization

- Case convention for headings and buttons (sentence case? title case?).
- Any rules about capitalizing nouns mid-phrase.

## Pluralization & grammar

- The language's plural rules and how they map onto `Str.pluralize` (which takes
  only singular + one plural form). Document the convention for the cases the
  helper cannot express.

## Formatting conventions

- Number / percent / currency formatting (e.g. space before `%`?).
- Time format (12h vs 24h).
- Date format.
- Punctuation specifics (quotes, ellipsis, …).
- **Em-dashes (`—`)**: avoid them in running copy; they read as artificial in
  prose. Prefer two sentences, a comma, or parentheses. The English source is
  kept dash-free, so keep translations dash-free too.

## Known inconsistencies to fix (audit backlog)

Spots in the language file that violate this guide and should be corrected by
the `translate` skill's `audit` mode. Add to this list as they are discovered.
