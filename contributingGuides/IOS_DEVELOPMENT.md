# iOS Development

## `xUnique` — deterministic `project.pbxproj`

The Podfile's `post_install` hook runs [`xUnique`](https://github.com/truebit/xUnique) after every `pod install` to keep `ios/kiroku.xcodeproj/project.pbxproj` diffs deterministic (CocoaPods otherwise assigns fresh random UUIDs every run, producing hundreds of lines of meaningless churn).

Install once:

```bash
pip3 install --user xUnique
```

Then make sure the install location is on your `PATH` (e.g. `~/.local/bin` or `~/Library/Python/3.x/bin`). The post_install hook auto-discovers common locations; if it can't find `xunique`, it prints a warning and continues — the build still works, but the pbxproj will accumulate random-UUID noise on each `pod install` that you'll need to discard manually with `git checkout ios/kiroku.xcodeproj/project.pbxproj`.
