# JavaScript Coding Standards

- As with many other systems across the project, we implement the coding practices from the Expensify App. See [this link](https://github.com/Expensify/App/blob/main/contributingGuides/STYLE.md) for the full guide on coding practices in this project.

## Kiroku-specific conventions

These supplement the Expensify guide with rules enforced specifically in this repo.

### Avoiding `any` type violations

The rules `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unsafe-assignment`, and `@typescript-eslint/no-unsafe-argument` are enforced as errors.

- Prefer proper types over `any`. When a cast to `any` or `ReactElement<any>` is genuinely necessary (e.g., for `cloneElement` with spread props), add the disable comment on the **preceding line**:

  ```ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cloneElement(child as React.ReactElement<any>, {...});
  ```

- Apply the comment consistently — if you add the same pattern in multiple places in a PR, every instance needs the comment.

### Module declarations with single named exports

If a `declare module` block uses a named export (required for module augmentation — default exports do not work in module declarations), suppress the `import/prefer-default-export` rule on the preceding line:

```ts
// eslint-disable-next-line import/prefer-default-export
export {getReactNativePersistence};
```
