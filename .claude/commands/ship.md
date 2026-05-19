---
allowed-tools: Bash(gh pr merge:*),Bash(gh pr view:*),Bash(gh pr list:*)
argument-hint: "[PR number]"
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

Once the target is resolved, run:

```bash
gh pr merge <N> --rebase --delete-branch
```

Report the result in one line (merged + branch deleted, or the error). Do not narrate the resolution step unless it failed.
