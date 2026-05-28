---
allowed-tools: Bash(gh pr diff:*),Bash(gh pr view:*)
description: Review changed non-English translation strings in a PR against each language's glossary/style guide. Use when a PR touches src/languages/*.ts.
---

Perform a translation-quality review using a specialized subagent:

## Inline Review

Use the translation-reviewer agent to:

- Scan the changed non-English translation strings in the PR diff
- Check each against its `src/languages/context/<locale>.md` glossary/style guide
- Detect glossary, register, do-not-translate, capitalization, formatting,
  interpolation, consistency, and missing-key violations with line-specific,
  actionable feedback

Run the agent. It will return structured JSON with any violations found.

## Output

Return the subagent's violations JSON as your structured output unchanged.
Do NOT post comments or reactions yourself - the workflow handles that.

<important>
Keep feedback concise. Only flag clear violations of the written guide.
</important>
