---
name: release-notes
description: Generate store-facing "What's New" release notes for Kiroku by comparing the last publicly shipped version on each store (App Store / Google Play) against current master. Use whenever the user wants release notes, what's-new text, a store changelog, copy for promoting a build to public release, or a user-facing summary of what changed since some version, for either or both platforms. Trigger even on loose phrasing like "we're pushing to the Play Store, write the notes" or "what's new since 0.3.13?". Not for the automated CI TestFlight changelog (scripts/generateReleaseNotes.sh owns that).
---

# Release Notes

Produce paste-ready store release notes ("What's New") per platform and locale by summarizing every user-visible change between the last publicly shipped version and the release being shipped (usually current master).

The two stores almost always have **different baselines**: Google Play production lags the App Store, sometimes by several minor versions. Treat each platform as its own comparison with its own notes. The notes are pasted manually into the consoles, so the deliverable is text in the final response, formatted per the template below.

## Inputs

You need, per requested platform, the last **publicly available** version:

- **iOS**: if the user doesn't supply it, read it live: `node scripts/asc.mjs status` and take the version in `READY_FOR_SALE` state.
- **Android**: there is no Play Console API wired up; the user must supply it. If they only know the minor (for example "0.3.10-something"), pass the bare minor to the script. It resolves to that minor's last build, and you must state that assumption next to the output so the user can correct it.

Version format mapping: the App Store displays `0.3.13.1`, which is internal version `0.3.13-1` (the deploy converts dashes to dots for iOS). The script accepts either form.

The "to" side defaults to `master`. Run `git fetch origin master:master` first if the local ref may be stale (or pass `origin/master` explicitly).

## Step 1: Collect the changes

```bash
bash .claude/skills/release-notes/scripts/collect_changes.sh <from-version> [<to-ref>]
```

The script resolves the version to a commit (release tags only exist as `X-N-staging` and old ones get pruned, so it anchors on the version-bump commit messages: `chore: release X-N` for the current era, `Version update: X-N` for releases up to ~0.3.11), then prints a header (resolved span, commit counts) followed by the commit subjects oldest-first, with release bumps, merges, deps, CI, docs, and test noise already filtered out.

If resolution fails (very old or rewritten history), find the commit by hand via `git log -S '"version": "X.Y.Z' -- package.json` and pass questions back to the user only if that also fails.

## Step 2: Write the notes

Work from the subject list, but write for a store visitor, not a developer:

- **User-visible changes only.** Skip refactors, tooling, and internal fixes that survived the filter. A fix earns a mention only if a user could have hit the bug.
- **Group thematically.** A multi-minor span (typical for Android) can contain hundreds of commits; collapse them into roughly 4 to 7 themes ("Redesigned navigation", "Faster startup", "Live session improvements"), each one short line. Lead with the change a user would notice first.
- **Plain language.** No commit references, no PR numbers, no library names, no jargon. "Fixed a crash when editing a session" beats "fix(session): guard undefined drinks".
- **Voice.** Friendly and concise. No em-dashes anywhere, in any locale (repo copy rule). Bullets start with a dash and a capital letter.
- **Don't leak unreleased plans.** Only describe what is actually in the target ref.

Produce every set of notes in **both locales: `en-US` and `cs`**. Write the Czech yourself following the voice and glossary in `src/languages/context/cs_cz.md`. These are marketing copy, not UI strings, so the `translate` skill machinery (en.ts keys) does not apply.

## Store constraints

| Store                    | Limit per locale | Aim for                            |
| ------------------------ | ---------------- | ---------------------------------- |
| Google Play release note | 500 chars, hard  | 350 to 480 chars                   |
| App Store "What's New"   | 4000 chars       | under 1200 chars                   |
| TestFlight changelog     | 4000 chars       | reuse the App Store text if needed |

For Google Play, print the character count next to each locale block; exceeding 500 makes the console reject the paste.

## Output format

ALWAYS use this template in the final response:

```markdown
## Android (Google Play): 0.3.10-25 -> 0.3.15-95

### en-US (412/500 chars)

- ...

### cs (438/500 chars)

- ...

## iOS (App Store): 0.3.13.1 -> 0.3.15-95

### en-US

- ...

### cs

- ...
```

State any baseline assumption (for example a bare minor resolved to its last build) directly under the platform heading.

## Where the text goes (and does not go)

- **Google Play**: pasted manually into the Play Console. CI never uploads changelogs (`skip_upload_changelogs: true` in the Fastfile), so this is the only path.
- **App Store**: pasted into App Store Connect for the release being prepared. Do not edit `fastlane/metadata/*/release_notes.txt` as a delivery mechanism: the deploy's `deliver` call overrides release notes with the auto-generated `TESTFLIGHT_CHANGELOG` env var, so file edits do not stick as a source of truth.

## Relationship to the CI script

`scripts/generateReleaseNotes.sh` is the automated, single-release-hop TestFlight note (previous tag to HEAD, Haiku, 300 chars). It serves a different cadence and stays as is. If you change commit-filtering rules here or there, keep the two consistent.
