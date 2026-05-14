---
name: git-branch-cleanup
description: >
  Audits and cleans up stale git branches and worktrees in a repository.
  Use this skill whenever the user wants to tidy up their repo, remove merged
  branches, prune old worktrees, or asks anything like "what branches can I
  delete?", "clean up my branches", "audit my worktrees", "remove stale
  branches", or "prune merged branches". Also trigger when the user notices
  there are too many branches and wants to get organized. This skill is
  session-aware: it will never propose deleting a branch that has an open
  Claude Code session attached to it.
---

# Git Branch Cleanup

Audit local branches, remote branches, and git worktrees — then help the user
safely delete the ones that are no longer needed.

## Step 1: Gather state (run all in parallel)

```bash
git branch -v                                          # local branches + tracking status
git branch -r                                          # remote refs
git worktree list                                      # active worktrees
git branch --merged <main-branch>                      # branches fully merged into main
gh pr list --state merged --json number,headRefName,mergedAt --limit 40
gh pr list --state open   --json number,headRefName,title
```

Determine the main branch name first (`git symbolic-ref refs/remotes/origin/HEAD` or
look for `master`/`main`). Use it consistently for `--merged` checks.

Also load Claude Code session data — use ToolSearch to fetch
`mcp__ccd_session_mgmt__list_sessions`, then call it with `limit: 40`. This
returns the `branch` and `cwd` fields for each session, which you need for the
protection rules below.

## Step 2: Identify protected branches (never propose for deletion)

Protect all of the following — silently exclude them from every category:

- **Current worktree branch** — the branch currently checked out in the worktree
  where you are running (from `git worktree list`, match the cwd)
- **All active worktree branches** — every branch listed in `git worktree list`
- **Open session branches** — any branch named in a Claude Code session that is
  `isRunning: true`, or any session whose `cwd` is inside a worktree path
  (regardless of `isRunning` — a paused session still represents live work)
- **Permanent branches** — `master`, `main`, `staging`, `production`, and any
  branch the user explicitly asks you to keep
- **feat/ and fix/ branches without a merged PR** — these are almost always
  intentional human work; move them to the Uncertain bucket rather than Safe

## Step 3: Classify the remaining branches

**Category A — Safe to delete (merged + remote gone)**
A branch belongs here when ALL of the following are true:
- Its remote tracking ref is `[gone]` (shown by `git branch -v`)  OR it appears
  in `git branch --merged <main>`
- Its head commit appears in a merged PR, OR it is confirmed merged into main

**Category B — Merged, remote still live**
A branch belongs here when:
- A merged PR exists with `headRefName` matching this branch
- But the remote ref still exists in `git branch -r`
Include the corresponding `origin/<branch>` ref as a separate deletion target.

**Category C — Stale / abandoned (no session, no open PR, superseded)**
A branch belongs here when:
- No open Claude Code session references it
- No open PR targets it
- It matches one or more of these signals:
  - Shares an exact commit hash with another branch (duplicate attempt)
  - Is a `claude/` automation branch pointing to a release commit
  - Its remote is `[gone]` and it has no open PR (remote cleaned up, work abandoned)

**Uncertain — ask the user**
Everything else that isn't protected and isn't clearly in A/B/C. Common examples:
- Has a remote but no open PR and no session
- `feat/` or `fix/` branch with no matched PR
- Branch whose purpose isn't clear from its name or tip commit

## Step 4: Report

Present a structured summary before touching anything:

```
## Worktrees  (all kept)
| Worktree dir | Branch | Session | Status |
|---|---|---|---|
| ... | ... | ... | keep |

## Proposed for deletion

### Category A — Merged + remote gone  (N branches)
| Branch | Reason |
|---|---|
| claude/foo-bar | merged PR #123 |

### Category B — Merged, remote still live  (N branches + N remote refs)
| Branch | Merged via |
|---|---|

### Category C — Stale / abandoned  (N branches)
List as comma-separated names; note the signal (e.g. "duplicate commit hash with X", "remote gone, no PR")

## Uncertain — your call  (N branches)
| Branch | Notes |
|---|---|
```

After the table, summarize: "**Total proposed: N local branches + M remote refs.**
Keeping: <protected list>."

Then ask the user to confirm or adjust before proceeding.

## Step 5: Execute after confirmation

When the user confirms (they may exclude items or add more):

1. **Local deletions** — one `git branch -D` call with all confirmed branch names
2. **Remote deletions** — one `git push origin --delete` call with all confirmed remote refs
3. Report what was deleted vs. skipped

Use `-D` (force-delete) for local branches — many will not be fully merged into
the current HEAD even if they were merged via PR, so `-f` is expected and safe here.

## Edge cases

- **Worktree branch mismatch**: A worktree directory name (e.g. `nice-swirles-c5e712`)
  may differ from the branch it checks out (e.g. `fix/android-rn081-entry-point`).
  Always protect the *branch name* shown in `git worktree list`, not the directory name.
- **No gh CLI**: If `gh` is unavailable, skip PR cross-referencing and rely on
  `[gone]` status and `git branch --merged` alone. Widen the Uncertain category.
- **No session MCP**: If `mcp__ccd_session_mgmt__list_sessions` can't be loaded,
  skip session awareness and note this in the report. Err on the side of caution —
  move ambiguous `claude/` branches to Uncertain rather than Safe.
- **Detached HEAD in a worktree**: Protect the commit, not a branch name. Skip
  the worktree from branch classification.
- **Remote deletion failures**: If `git push origin --delete` fails for one ref
  (e.g. protected branch policy), report it and continue with the rest.
