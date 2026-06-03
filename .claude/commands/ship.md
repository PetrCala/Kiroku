---
allowed-tools: Bash(gh pr merge:*),Bash(gh pr view:*),Bash(gh pr list:*)
argument-hint: '[PR number]'
description: Rebase-merge a PR and delete its branch. Targets the PR worked on in this session unless an argument is provided.
---

Rebase-merge a PR and delete its branch.

## Target PR resolution

1. **If `$ARGUMENTS` is non-empty**, treat it as the PR number and use it directly.
2. **Otherwise**, look back through this session for PRs you opened, merged, commented on, or otherwise referenced (e.g. `gh pr create` output, `https://github.com/.../pull/<N>` links, `gh pr merge <N>` calls).
   - **Exactly one PR in session** → use it.
   - **Multiple distinct PRs** → STOP. Tell the user which PR numbers you saw and ask them to re-run as `/ship <number>`. Do not guess.
   - **Zero PRs** → STOP. Tell the user to pass a PR number: `/ship <number>`.

## Execute

Once the target is resolved, rebase-merge it and delete its branch **without
checking out the default branch**. Do **not** use `gh`'s `--delete-branch`: it
switches the local checkout to the default branch after merging, which is wrong
inside a git worktree — and fails outright (`'master' is already used by
worktree ...`) when the default branch is checked out in another worktree. So
merge with `--rebase` only, then clean the branch up by hand:

```bash
BRANCH="$(gh pr view <N> --json headRefName --jq .headRefName)"
gh pr merge <N> --rebase
# If this checkout sits on the merged branch, step off onto a detached HEAD so
# the branch can be deleted and we never land on the default branch.
[ "$(git branch --show-current)" = "$BRANCH" ] && git checkout --detach
git branch -D "$BRANCH" 2>/dev/null
git push origin --delete "$BRANCH"
```

`git branch -D` is required because a rebase-merge gives the local branch new
commit hashes, so it isn't an ancestor of the default branch. A remote that
auto-deletes head branches on merge will make the final `push --delete` report
"remote ref does not exist" — that's a success, not an error.

Report the result in one line (merged + branch deleted, or the error). Do not narrate the resolution step unless it failed.
