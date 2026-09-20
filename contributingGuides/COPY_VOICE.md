# Copy voice

How Kiroku talks to people. This covers every string a user reads: `en.ts` and
its translations, store listings, release notes, screenshot captions, App Store
purchase-sheet names, and emails. Each language's glossary, register, and
grammar live in `src/languages/context/<locale>.md`; this file is the voice
they all follow.

## What Kiroku is

Kiroku is for keeping track of your alcohol adventures together. People log
their drinks and share them with their friends. The social side is the point. That's where the fun is.

Hiding your sessions from friends is a setting, and a fine choice. It's not the
pitch. Store listings, captions, and onboarding lead with friends and sharing.
Privacy gets one plain line, late: "Want to keep it to yourself? Hide your
sessions in Settings."

## Who's talking

One of the group: the friend who knows what everyone's having, says things
straight, and keeps it short. Not a company, a coach, or a doctor. What people
drink is their business. The app records it and never comments on how much.

## The sound of it

The store description is the reference recording. Before writing anything a
user reads, read these lines and match their cadence:

> Keep track of your alcohol adventures together. Log your drinks and share
> them with your friends.

> Start a session when you head out, add drinks as the rounds come, and look
> back at the night in your calendar.

> Want to keep it to yourself? Hide your sessions in Settings.

Verbs, second person, a scene the reader recognizes, and no opinion about how
good the app is. Every rule below is trying to produce that sound. When a rule
and this section disagree, this section wins.

## Plain by default, playful on purpose

Most copy is utility, and utility copy is plain, short, and literal. Personality
is saved for a few chosen moments. Cheeky is welcome there, as long as the pun
is clever. A joke that needs explaining, or one that's only there to be a joke,
gets cut.

| Mode    | Where                                                                                                                    | Sounds like                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Utility | Labels, buttons, settings, empty states, loading, errors, fine print, anything legal                                     | "Nothing to plot here." · "Check your connection and try again." · "Per week"                                 |
| Playful | Hero headlines, slogans, store openers, promotional text, captions, thank-yous, celebrations, the tip jar, release notes | "Keep track of your alcohol adventures" · "Log your drinks and share them with your friends" · "Dýško koutek" |

One screen can hold both. On the tip jar, the headline, the thanks, and the bar
tab are playful; the buy button, the fine print, and the errors stay plain.

## Words

- **"Alcohol adventures" is the anchor phrase.** It's on the website, the
  README, the login screen, and the store. Reach for it before inventing a new
  tagline. Czech: "alkoholová dobrodružství".
- **Use:** friends, share, session, round, log, "Log your drinks and share them
  with your friends".
- **Don't use in marketing:** diary, journal, private or privacy-first as a
  headline, awareness, mindful, habits, "track your consumption", harm
  reduction. Harm reduction stays in the fine print and the App Review notes,
  where it's a fact, not a slogan.

## Utility copy

- **Name the thing precisely.** "Per week" beats "This period".
- **Literal beats euphemism.** "Alcohol-free day", never "quiet day".
- **Cut mood that carries no information.** Empty states used to open with "A
  quiet range" and close with "that counts"; now they just say "Nothing to
  plot here." If a phrase only sets a mood, delete it.
- **Stay factual about other people.** "This person keeps their drinking
  sessions private."
- **Errors say what happened and what to do next,** in that order.

## Playful copy

- **The pub is the home metaphor:** beer, rounds, the bar tab, coasters,
  cheers. Reach for it before inventing a new one.
- **Puns earn their place.** If it only works with an explanation, or it's a
  pun on a word nobody uses, cut it.
- **Invite, don't sell.** Supporting the app is treating someone to a beer, not
  a transaction. Name a real recipient when you can: "Pozvi vývojáře na pivko"
  (invite the developer for a beer) rather than a faceless "us".
- **Say plainly where the money goes.** "To support the app development" rather
  than making the user judge the app first ("If it helps you").
- **Turn thanks back to the user.** "Now go and have one yourself!" beats "It
  genuinely helps."
- **Be cheeky and honest together.** "More beers for us, more features for
  you!" admits the beer is ours and names what the user gets.
- **Exclamation marks belong to punchlines:** at most one per line, never in
  utility copy.
- **Don't overpromise.** A tip unlocks nothing, so no playful line may suggest
  it does. Features are for everyone.

## Shapes we don't write

Word lists don't catch bad copy. Shapes do. Every line in this section passed a
vocabulary check and still read as machine-written.

### The opener is a sentence

A headline has a finite verb and a subject the reader recognizes. It says what
someone does or sees, never how good the result is.

| Don't                                                        | Why                                                                      | Do                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| "Photos on your sessions, and a session page worth opening." | No verb, two noun phrases balanced for rhythm, and it rates our own work | "Take a photo on the night out, and it stays with the session."  |
| "Your session now lives on the Home screen."                 | Describes the screen instead of the evening                              | "Start a session when you head out, and watch the night add up." |

### The shapes

- **No verbless balanced fragments.** "X, and Y worth Z-ing" is the same rhythm
  trick as "not just X, it's Y". If the line has no finite verb, rewrite it.
- **No colon followed by three items.** "Redesigned calendar: clearer tiles, a
  streak ramp, and a sharper ring on today." Three is a rhythm, not a fact.
  Write the two that matter, as a sentence.
- **No "now" plus a noun phrase as a whole line.** "The session page is now a
  full activity detail page" gives the reader nothing to picture.
- **No intensifier carrying the argument.** "What you actually drink",
  "finally", "properly", "truly". Delete the word and see whether the line still
  claims anything.
- **No rating our own work.** "Worth opening", "the session page you deserve",
  "finally usable". Say what it does and let the reader decide.

### Name the night, not the screen

Write what the reader does, not the control they touch. These names are ours.
They belong in the code, not in copy people read.

| Ours                 | Theirs                  |
| -------------------- | ----------------------- |
| quick-add row        | adding a round          |
| activity detail page | the session             |
| session tile         | a night in the calendar |
| live card, Home      | the session you're in   |
| streak ramp          | your alcohol-free days  |

## Store listings

- **Order:** the social pitch first, then what you can do, then privacy in one
  line, then the fine print.
- **The fine print stays plain and stays put:** 18+, no medical advice, and
  "Kiroku doesn't reward, encourage, or gamify drinking." These match what the
  App Review notes tell Apple.

## Things we never do

- Compete on volume: "who drank most", drinking challenges, leaderboards,
  streaks of drinking days. Apple rejects apps that encourage heavy drinking,
  and it isn't the fun we're selling anyway.
- Sell privacy as the main reason to use the app.
- Guilt, pressure, or urgency ("Don't leave us", countdowns, "only today").
- Tell people how sincere or fair we are: "genuinely", "truly", "honestly",
  "really", "honest", "nobody judges", "no judgement", "judgment-free". Warmth
  comes from what the line says, not from vouching for ourselves.
- Tell people how good the feature is: "worth opening", "finally usable", "the
  session page you deserve". Describe what it does; the reader judges it.
- Moralizing about drinking, or praise and blame for how much someone drank.
- Em dashes and en dashes in running copy. Use two short sentences, a comma, or
  parentheses.

## Translations adapt, they don't transliterate

- **Utility strings stay close to the English.**
- **Playful strings get rewritten in the language's own idiom.** They have to
  land the same way, not say the same words. "Tip jar" became "Dýško koutek" (a
  pun on "disko koutek"), and "Buy us a beer" became "Pozvi vývojáře na pivko".
  Colloquial forms like "pivko" are welcome here.
- **A playful name, once chosen, is a glossary term.** Use it everywhere the
  feature appears (titles, loading, errors) and decline it correctly. Add it to
  the locale's glossary in the same change.
- **Formal vs informal "you":** languages that have both default to formal and
  may switch to informal in punchlines only. The locale guide has the specifics.

## Before shipping copy

1. Is this a utility string or a playful moment? Write in that mode.
2. Does marketing copy lead with friends and sharing, not privacy?
3. Can a word go? Can a whole clause go?
4. Any euphemism, sincerity word, guilt, volume contest, or promise we can't
   keep?
5. Does the opening line have a verb? Read it aloud. If it sounds like a product
   page, it is one.
6. Any name in it that only exists in our code ("quick-add row", "activity
   detail page")?
7. For translations: adapted (playful) or kept close (utility)? Is the feature's
   name the same everywhere?
