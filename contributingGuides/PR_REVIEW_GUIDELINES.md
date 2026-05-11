# PR review guidelines

# Testing the changes

1. Make sure there are no console errors related to the PR. If you find console errors in a branch you’re reviewing, check if they also exist in `master`.
   1. If they do, proceed as normal and report them in the project Discord if you think they need to be fixed.
   2. If the errors do not exist in `master`, report it to the PR author - they need to be fixed before the PR can be merged.
2. Test the changes on **all platforms**.
   - If you’re unable to boot a platform for any reason, ask for help in the **#technical-advice** Discord channel. Your issue might already have been addressed there, so be sure to search first.

# Reviewing the code

## Good code patterns to require

1. Check that functions have comments when appropriate.
   - If the function has params or returns something, use [JSDocs syntax](https://github.com/PetrCala/Kiroku/blob/master/contributingGuides/STYLE.md#jsdocs) to describe them.
     - Indicate the param name(s), data type passed and / or returned, and purpose if not immediately obvious.
   - Obvious functions (with no params / return value) should not have comments.
   - **In short: _Add comments & docs, only when useful._**
2. All copy / text shown to users in the product should be stored in the `src/languages/*` files for localization.
3. Platform-specific files should follow the proper naming convention (see [Platform-Specific File Extensions](https://github.com/PetrCala/Kiroku/#platform-specific-file-extensions))
   - Example: `MyComponent/index.android.js`
