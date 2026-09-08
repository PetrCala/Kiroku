# Moving iOS to `com.kiroku.app`

Kiroku's iOS bundle id was still the React Native template placeholder,
`org.reactjs.native.example.alcohol-tracker`. This guide covers the move to
`com.kiroku.app`, an App ID that was already registered in the developer portal
alongside a clean, build-free App Store Connect record ("Kiroku Placeholder",
app id `6670502234`, SKU `kiroku-ios-app`).

**This is a cleanliness change, not a fix for anything.** It was originally
proposed as a fix: 0.3.24 had sat in `WAITING_FOR_REVIEW` for eleven days, and
six earlier submissions appeared to have failed since May 2026, so the
placeholder bundle id looked like the culprit. That reading was wrong and the
investigation is worth not repeating.

Resolution Center is empty. Apple has never rejected this app, and on the
evidence has never reviewed it. The six earlier submissions each end `COMPLETE`
with their item in state `REMOVED`, never `REJECTED`, which is what withdrawal
looks like: App Store Connect permits one open submission at a time, so each new
one required clearing the last. Note that `REMOVED` alone would not prove this,
since a rejected-then-cleared submission ends in the same state; the empty
Resolution Center is what carries it.

So there is no history of Apple objecting to anything, and the elaborate
BAC-and-impairment rebuttal in the review notes is preemptive rather than a
response to a rejection. What remains is a single long wait on a first-ever
review with three in-app purchases attached: unusual, but one data point, and
nothing about it implicates the bundle id.

Do the move because `org.reactjs.native.example.alcohol-tracker` is not an
identity to carry forever, and because it is cheapest now, while there is no
public release, no users, no ratings and no purchase history to strand. Do not
do it expecting review to behave differently afterwards.

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

### 1. The in-flight submission, and the name it holds

Submission `a1c6951f` on the old record holds version 0.3.24 plus the three tip
products, and has been `WAITING_FOR_REVIEW` since 28 August 2026.

**Leave it running for now.** Apple has never actually reviewed this app: every
earlier submission ends `COMPLETE` with its item `REMOVED` rather than
`REJECTED`, and Resolution Center is empty. So this is the only experiment that
can produce a review outcome, and there has never been one to learn from. The
version's `releaseType` is `MANUAL`, so an approval cannot reach the public on
its own. If it comes back with a content objection, that objection applies just
as much to the new record, and it is far cheaper to learn that now than after
the signing, Firebase, listing and IAP work.

**But it blocks the rename in section 4, so the experiment is bounded.** The app
name does not live on the app record or on a version. It lives in
`appInfoLocalizations`, hanging off an `appInfo` whose state tracks the
submission:

| Record           | `appInfo` state          | `en-US` name         |
| ---------------- | ------------------------ | -------------------- |
| Old `6466886157` | `WAITING_FOR_REVIEW`     | `Kiroku`             |
| New `6670502234` | `PREPARE_FOR_SUBMISSION` | `Kiroku Placeholder` |

The old record has one `appInfo` and no editable sibling, so while the
submission is in flight its name is locked, and App Store names are unique, so
the new record cannot take `Kiroku` until the old one gives it up.

Everything else in this guide is independent of that. Run the sections in order
and stop before the rename in section 4. At that point either the review has
concluded (you have your answer and the lock is gone) or you decide the answer
is no longer worth waiting for and cancel then. Cancelling on day one buys
nothing and throws the experiment away.

Separately, delete the stray review submission `ddac2922`: `READY_FOR_REVIEW`,
never submitted, zero items, left behind by an aborted `asc.mjs submit --yes`
run some time after 28 August. It is inert, since the plan never submits against
the old record again, but it is noise on a record being retired.

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

One field on the new record is unset and will block a submission if left that
way: `contentRightsDeclaration` (the old record has
`DOES_NOT_USE_THIRD_PARTY_CONTENT`). The age rating declaration does **not**
need carrying over: it is already populated on the new record and identical to
the old one, `alcoholTobaccoOrDrugUseOrReferences` included.

#### Reconcile the version string

The new record's only version is `1.0`, created with the record. The app builds
`CFBundleShortVersionString` `0.3.24`. App Store Connect offers a version only
the builds whose short version string matches it, so these have to agree before
0.3.24 can be submitted there.

This binds at submission, not at upload: a build uploads against the bundle id
and reaches TestFlight regardless, so the mismatch does not block testing. Worth
confirming on the first upload to the new record rather than trusting it.

Renaming the record is the cheap side, one call, no code:

```bash
node scripts/asc.mjs rename --app-id 6670502234 --to 0.3.24
```

`--version` defaults to the lone `PREPARE_FOR_SUBMISSION` version, which is the
`1.0` one. Note that `rename` is not dry-run by default the way `submit` is: it
PATCHes immediately.

The alternative is to bump the app to `1.0.0`, which a new record and a real
bundle id arguably invite. Prefer the rename anyway, and treat `1.0.0` as a
separate decision made on its own merits later. Changing the version scheme in
the same move as the bundle id means that if review still stalls, you cannot
tell which of the two mattered, and the whole migration is already a hypothesis.

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
