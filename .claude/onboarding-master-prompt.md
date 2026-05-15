# Onboarding epic — master prompt template

Paste this into the orchestrating session and replace `<NUMBER>` with the next GitHub issue (one of #352–#359). Run one issue per cycle. Do not queue multiple in parallel — the epic ships on a single branch and a single PR ([#361](https://github.com/PetrCala/Kiroku/pull/361)).

---

You are continuing the onboarding rebuild epic on branch `feature/onboarding-rebuild` (PR #361). Implement GitHub issue #<NUMBER>.

## Invariants

- Stay on `feature/onboarding-rebuild`. Do not create new branches, switch branches, rebase against master, or open/close PRs. PR #361 already tracks this branch.
- Issues #350–#359 ship as one PR. Do not merge to master under any circumstances.
- Scope strictly to issue #<NUMBER>. Do not pre-plan or pre-implement future issues, even if you notice obvious next steps.
- Read `CLAUDE.md` before editing if you haven't this session. Honor the post-edit checklist exactly.

## Step 1 — Load the issue

- Run `gh issue view <NUMBER> --comments` and read it fully, including comments.
- Run `git log --oneline master..HEAD` to see what previous issues in this epic have already landed. Your plan must build on the **current** state of the branch, not the state described in older issues.
- If the issue references prior work (Onyx keys, selectors, types, DB schema), open those files to confirm the actual shape — don't assume.

## Step 2 — Draft a plan

- Produce a tight implementation plan: files to add/modify, key types/functions/screens, integration points with prior epic commits.
- Call out anything ambiguous in the issue and state your interpretation.
- **STOP and wait for explicit approval.** Do not edit any file until I say "go" (or equivalent). If I push back, revise and re-present.

## Step 3 — Implement

- After approval, implement the plan.
- Follow `CLAUDE.md`, the `/coding-standards` skill, and the `/onyx` skill for any state-management work.
- No unrelated refactors. No features beyond the issue. No comments unless the WHY is non-obvious.
- Avoid `any` casts unless genuinely necessary — if needed, add the disable comment on the preceding line per `CLAUDE.md`.

## Step 4 — Post-edit checklist (mandatory, in order)

Run each step. Fix failures before continuing. Do not bypass with `--no-verify`.

1. `npx prettier --write <changed files>`
2. `npm run lint-changed`, then `npm run lint`
3. `npm run typecheck-tsgo` (if types/interfaces/function signatures changed)
4. `npm run react-compiler-compliance-check check-changed` (if components or hooks were added or modified)

## Step 5 — Commit

- One commit on `feature/onboarding-rebuild`. Match the epic's existing commit style:
  - `feat(onboarding): <short description> for #<NUMBER>`
  - Use `fix`/`refactor`/`chore`/`docs` instead of `feat` if more accurate.
- Stage only files relevant to this issue. Do not blanket-add.
- Do not push. Do not amend prior commits.

## Step 6 — Wrap

- Run `git status` to confirm a clean tree.
- Call `mark_chapter` with title `Issue #<NUMBER>: <short topic>`.
- Summarize in 2–3 sentences: what shipped, anything the next issue should know about (new types added, selectors renamed, schema gotchas).
- **STOP.** Do not start the next issue until I queue it with a fresh invocation of this template.

## If something goes sideways

- Plan reveals the issue overlaps another open issue → surface it, propose a scope cut, wait for direction.
- Post-edit checklist fails in a way you can't fix in ~3 attempts → stop, report the failure, wait.
- You discover a bug in already-landed epic work → flag it, do not silently fix it inside this issue's commit.
