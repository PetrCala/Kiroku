# Czech (cs_cz) translation guide

> Locale: `cs_cz` · Language: Czech · Source of truth: `src/languages/en.ts`
>
> This is the authoritative context for every Czech translation in Kiroku. The
> `translate` skill and the CI translation reviewer both read this file. When a
> term, tone, or convention here conflicts with an existing string in
> `cs_cz.ts`, **this guide wins** — the string is the bug, not the guide.

## How to use this file

- **Adding/changing Czech strings?** Match the glossary, register, and
  conventions below. Do not invent a new word for a term that already has a
  canonical translation.
- **Found a term not covered here?** Pick the most consistent option, then add
  it to the glossary so the next translation matches.
- **Disagree with a decision?** Change it here first (and note it under
  "Decisions"), then run the `translate` skill in `audit` mode to propagate.

## Decisions (confirm with the product owner)

These are contested choices where the existing `cs_cz.ts` was inconsistent. The
listed default is what the glossary enforces today; change the default here if
the product voice should differ.

| Topic                              | Default                               | Alternative                | Notes                                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Word for "drink" (the beverage)    | **drink / drinky**                    | nápoj / nápoje             | Product voice prefers the loanword `drink`. Declines as a hard masc. inanimate: gen sg `drinku`, nom/acc pl `drinky`, gen pl `drinků`, dat pl `drinkům`, loc pl `drincích`. Do **not** use `nápoj`. |
| Register (how we address the user) | **vykání** (formal 2nd-person plural) | tykání (informal singular) | The app is overwhelmingly vykání. The `statistics.*` section drifted to tykání — treat that as drift to fix, not a second standard.                                                                 |
| "Kiroku Supporter" tier name       | **keep English** ("Kiroku Supporter") | "podporovatel Kiroku"      | The tier is a brand/product name; the role/verb ("podpořit", "podporovatel") stays translated.                                                                                                      |

## Register & tone

- **Address the user with vykání** — formal 2nd-person plural ("máte", "chcete",
  "jste si jisti?"). This applies everywhere, including statistics copy.
- **Buttons / short actions** use the bare imperative verb: `Uložit`, `Zrušit`,
  `Potvrdit`, `Pokračovat`, `Smazat`.
- **Full-sentence CTAs and links** use polite plural imperative: `Přihlaste se
zde`, `Přidejte si je zde`, `Zkuste hledat zde`.
- Tone is friendly but not flippant. Avoid archaic interjections ("Ejhle…");
  prefer a consistent casual "Ups" for error/oops copy.
- **Past-tense gender agreement**: when the subject is the user and gender is
  unknown, use the slashed form: `pil/a`, `zaměřil/a`. Use this consistently.

## Glossary (canonical terms)

| English                     | Czech (canonical)                                 | Do NOT use     |
| --------------------------- | ------------------------------------------------- | -------------- |
| session                     | **relace**                                        | sezení         |
| drinking session            | **alkoholová relace**                             | relace pití    |
| live (session)              | **živá** (relace)                                 |                |
| edit / past (session)       | **zpětná** (relace)                               |                |
| unit / units                | **jednotka / jednotky / jednotek**                |                |
| drink / drinks (beverage)   | **drink / drinky** (gen sg drinku, gen pl drinků) | nápoj / nápoje |
| beer                        | **pivo**                                          |                |
| small beer                  | **malé pivo**                                     |                |
| wine                        | **víno**                                          |                |
| weak shot                   | **malý panák**                                    |                |
| strong shot                 | **velký panák**                                   |                |
| cocktail                    | **koktejl**                                       |                |
| other (drink type)          | **ostatní**                                       |                |
| statistics / stats          | **statistiky**                                    |                |
| calendar                    | **kalendář**                                      |                |
| profile                     | **profil**                                        |                |
| friend / friends            | **přítel / přátelé**                              |                |
| friend request              | **žádost o přátelství** (short: "žádost")         |                |
| supporter (role)            | **podporovatel**                                  |                |
| badge / badges              | **odznaky**                                       |                |
| sober                       | **bez pití**                                      |                |
| alcohol-free day(s)         | **dny bez alkoholu**                              |                |
| quiet day(s)                | **klidné dny**                                    |                |
| blackout                    | **výpadek paměti**                                |                |
| streak (alcohol-free)       | **série** (dnů bez alkoholu)                      |                |
| session intensity: light    | **mírná** (relace)                                | lehká          |
| session intensity: moderate | **střední** (relace)                              |                |
| session intensity: heavy    | **těžká** (relace)                                | silná, náročná |

## Do-not-translate (keep verbatim)

`Kiroku`, `Kiroku Supporter` (tier name), `OK`, `N/A`, `Google`, `Apple`,
`App Store`, `Google Play`, `TestFlight`, `Discord`, `QR`, `Menu`, version
prefix `v`, and any dev-only / test-tools
strings that reference English menu paths or feature-flag names.

## Capitalization

- Czech uses **sentence case**, not English Title Case. Convert headings and
  button labels: `Friend List` → `Seznam přátel`, `Session Summary` →
  `Souhrn relace`.
- Never capitalize a noun mid-phrase to mirror English (`Alkoholová Relace` is
  wrong; use `Alkoholová relace`).

## Pluralization & grammar

Czech has **three** plural forms (1 / 2–4 / 5+), but the shared `Str.pluralize`
helper only takes two arguments (singular + one plural).

- **Convention today:** pass the genitive-plural (5+) form as the second
  argument. This is correct for 1 and 5+, and accepted-as-imperfect for 2–4
  (e.g. "2 jednotek" instead of "2 jednotky").

  ```ts
  monthTotalUnits: ({unitCount}: UnitCountParams) =>
    `${unitCount} ${Str.pluralize('jednotka', 'jednotek', unitCount)}`,
  ```

- If correct 2–4 forms become important, that needs a Czech-aware 3-form
  pluralize helper — out of scope for a single string; raise it as a separate
  task before hand-rolling per-string `count % …` logic.

## Formatting conventions

- **Percent sign**: Czech puts a space before `%` — `75 %`, `(${share} %)`
  (English has none). Apply the space.
- **Time**: prefer 24-hour. Avoid introducing new "AM"/"PM" copy.
- **Dates**: the app currently uses ISO `YYYY-MM-DD` (`common.dateFormat`),
  shared across locales — leave as-is unless the product asks for Czech
  `D. M. YYYY`.
- **Ellipsis**: use the single `…` character, not three dots.

## Known inconsistencies to fix (audit backlog)

The previous backlog (term drift to "sezení"/"relace pití"/"nápoj", tykání in
`statistics.*`, the `profileScreen` Title-case +
"Zkomzumovaných" typo, and the four missing keys) was cleared in the
`cs_cz.ts` audit. The "drink" beverage term was later flipped from `nápoj` back
to the loanword `drink` per the product owner. Nothing outstanding — add new
items here if drift reappears.
