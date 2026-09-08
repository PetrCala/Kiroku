# Moving iOS to `com.kiroku.app`

Kiroku's iOS bundle id was still the React Native template placeholder,
`org.reactjs.native.example.alcohol-tracker`. This guide covers the move to
`com.kiroku.app`, an App ID that was already registered in the developer portal
alongside a clean, build-free App Store Connect record ("Kiroku Placeholder",
app id `6670502234`, SKU `kiroku-ios-app`).

**Read this first.** The move is not proven necessary. It was proposed because
the App Store submission of 0.3.24 sat in `WAITING_FOR_REVIEW` for eleven days
without ever reaching `IN_REVIEW`, and because the placeholder bundle id is the
most conspicuous anomaly on an app that has failed to clear review seven times
since May 2026. Nothing technical is broken: the build validates, export
compliance is answered, and Kyuhachi (the same App Store Connect team) ships
in-app purchases without trouble. The actual reason, if Apple has given one,
is in Resolution Center, which the App Store Connect API cannot read. **Check
there before spending the rest of this guide.** A name collision with the other
published app called Kiroku, for instance, would not be helped by a new bundle
id.

You cannot change the bundle id on the existing record: that field locks once a
build is uploaded, and `6466886157` has build 0.3.24.19 on it. The move means
adopting the second record, not editing the first.

## The mapping

| Old                                                            | New                                                |
| -------------------------------------------------------------- | -------------------------------------------------- |
| `org.reactjs.native.example.alcohol-tracker`                   | `com.kiroku.app`                                   |
| `org.reactjs.native.example.alcohol-tracker.adhoc`             | `com.kiroku.app.adhoc`                             |
| `org.reactjs.native.example.alcohol-tracker.watchkitapp`       | `com.kiroku.app.watchkitapp`                       |
| `org.reactjs.native.example.alcohol-tracker.adhoc.watchkitapp` | `com.kiroku.app.adhoc.watchkitapp`                 |
| `org.reactjs.native.example.$(PRODUCT_NAME:rfc1034identifier)` | `com.kiroku.app.$(PRODUCT_NAME:rfc1034identifier)` |
| `com.alcohol-tracker.*` (test targets)                         | `com.kiroku.app.*`                                 |

The simulator/device split is preserved: on `iphonesimulator` the id still
resolves through `$(PRODUCT_NAME:rfc1034identifier)` (now `com.kiroku.app.kiroku`)
while the real id stays scoped to `[sdk=iphoneos*]`. See
[`scripts/set-simulator-bundle-id.rb`](../scripts/set-simulator-bundle-id.rb).

Android is untouched. Its `applicationId` is `com.alcohol_tracker`, which is
independent of the iOS bundle id and already not a placeholder.

## Done in code

The Xcode project, both fastlane configs, the three App Store Connect scripts,
the two Ruby helpers, the screenshots workflow, and the affected guides. Nothing
here reaches the network.

## Still to do

### 1. Cancel the in-flight submission

Submission `a1c6951f` on the old record holds version 0.3.24 plus the three tip
products. Cancel it before building against the new record, or the two compete.

### 2. Signing (automated)

Three idempotent commands, each a dry run until `--yes`. They register any
missing App IDs, enable Push and Sign in with Apple to match
[`ios/kiroku/kiroku.entitlements`](../ios/kiroku/kiroku.entitlements), mint the
profiles against the existing distribution certificate (no rotation), and
re-encrypt the committed `.gpg`:

```bash
node scripts/ios-signing.mjs app-setup    # com.kiroku.app          -> Kiroku
node scripts/ios-signing.mjs adhoc-setup  # com.kiroku.app.adhoc    -> Kiroku_AdHoc
node scripts/ios-signing.mjs watch-setup  # the two watch App IDs   -> KirokuWatch*
```

Review the plan each prints, re-run with `--yes`, then commit the changed
`ios/*.mobileprovision.gpg`. Afterwards `node scripts/ios-signing.mjs check --deep`
should report every profile healthy.

### 3. Firebase (manual, then commit)

The three `ios/config/GoogleService-Info.*.plist` files are deliberately
untouched: they are generated, and `GOOGLE_APP_ID`, `CLIENT_ID`,
`REVERSED_CLIENT_ID` and `API_KEY` all change together. Hand-editing only
`BUNDLE_ID` produces a config that looks right and misroutes at runtime.

Register new iOS apps and download fresh plists:

| File                             | Firebase project         | Bundle id              |
| -------------------------------- | ------------------------ | ---------------------- |
| `GoogleService-Info.prod.plist`  | `alcohol-tracker-db`     | `com.kiroku.app`       |
| `GoogleService-Info.dev.plist`   | `dev-alcohol-tracker-db` | `com.kiroku.app`       |
| `GoogleService-Info.adhoc.plist` | `dev-alcohol-tracker-db` | `com.kiroku.app.adhoc` |

Then replace the three `REVERSED_CLIENT_ID` values in the `CFBundleURLSchemes`
array in [`ios/kiroku/Info.plist`](../ios/kiroku/Info.plist) with the ones from
the new plists, in the same order. Google Sign-In breaks silently if these drift.

Auth users are keyed to the Firebase project, not the iOS app, so no accounts
are lost.

### 4. The App Store Connect record

Rename the old record to free the name, then rename `Kiroku Placeholder` to
`Kiroku`. Recreate the listing on the new record: description, keywords,
screenshots (`npm run frame-screenshots`, see
[`SCREENSHOTS.md`](./SCREENSHOTS.md)), age rating, privacy, and the review
notes plus demo account.

Keep the old record until the new one is approved. Do not delete it.

### 5. In-app purchases

**This is the expensive part.** Product ids are scoped to the developer account
and Apple does not let you reuse one, even after deleting it. The four existing
ids (`kiroku.tip.small_beer`, `kiroku.tip.pint`, `kiroku.tip.round`,
`supporter_lifetime`) belong to the old record, so plan on new ids. Verify the
no-reuse rule against Apple's current documentation before committing to a
naming scheme.

If new ids are needed:

1. Update `CONST.TIPS.PRODUCT_IDS` in [`src/CONST.ts`](../src/CONST.ts) and the
   `TIPS` table in [`scripts/asc-tips.mjs`](../scripts/asc-tips.mjs). They must
   match exactly.
2. Re-run the whole setup: `node scripts/asc-tips.mjs setup`, then
   `screenshot <png>`. See [`TIP_JAR.md`](./TIP_JAR.md), whose App Store Connect
   traps all still apply.
3. Re-register the products in the RevenueCat dashboard as non-subscription
   products under the new ids, and point the RevenueCat iOS app at
   `com.kiroku.app` with the new App Store shared secret.

### 6. Ship

Build, upload to the new record, and submit with the products attached:

```bash
node scripts/asc.mjs submit --iaps <id>,<id>,<id> --yes
```

Attaching them matters on a first submission: products submitted on their own
sit in Waiting for Review indefinitely.

## Fallout

TestFlight testers install a new app rather than updating, because a different
bundle id is a different app. The review clock restarts. Nothing else is
affected: the app has never been publicly released, so there are no production
users, no ratings, and no purchase history to carry over.

## Rolling back

The code half is one revert. The portal half is not destructive: the old App
IDs, profiles and app record all survive, so reverting the commit and re-running
the three signing commands with the old `--bundle-id` restores the previous
state.
