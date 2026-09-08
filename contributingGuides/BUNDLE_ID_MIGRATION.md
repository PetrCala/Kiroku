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

The old record has one `appInfo` and no editable sibling. Two claims stack here
and they are not equally solid. App Store names being unique is certain, so the
new record cannot take `Kiroku` while the old record holds it. That
`WAITING_FOR_REVIEW` on an `appInfo` blocks editing its localizations is
_inferred from the state's name and has not been tested_, because testing it
means attempting a PATCH.

The distinction happens not to change what you do. Freeing the name requires
renaming the old record either way, and that is a mutation to sequence late
regardless. Recorded so a future reader does not re-derive the question on
discovering the lock was never actually verified.

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

**One decision inside `app-setup` is not automatic, whatever the dry run says.**
It enables Sign in with Apple as `PRIMARY_APP_CONSENT`, making `com.kiroku.app`
its own Sign in with Apple primary. Apple scopes the `sub` it returns to the
primary App ID, so anyone who signed in under the old bundle id returns with a
different `sub`, and Firebase reads that as a different account. Sign in with
Apple is wired up (`AppleAuthWrapper` in `src/App.tsx`, `apple.com` throughout
`ConnectedAccountsScreen`), so this is real rather than theoretical.

The alternative is grouping the new App ID under the old one as primary rather
than making it a primary itself. The setting cannot be usefully changed once
accounts have diverged, so it is decided at `--yes` and not afterwards.

What makes it survivable here is that Kiroku has never shipped publicly: the
exposed population is TestFlight testers with an `apple.com` provider linked,
which is a knowable and probably tiny set. Check it before running, rather than
inheriting the default because the dry run looked clean.

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

Auth users are keyed to the Firebase project rather than the iOS app, so
email/password and Google accounts survive. **Sign in with Apple does not**: see
the scoping note in section 2, which has to be decided before `app-setup --yes`
rather than here.

### 4. The App Store Connect record

Rename the old record to free the name, then rename `Kiroku Placeholder` to
`Kiroku`. Recreate the listing on the new record: description, keywords,
screenshots (`npm run frame-screenshots`, see
[`SCREENSHOTS.md`](./SCREENSHOTS.md)), age rating, privacy, and the review
notes plus demo account.

Keep the old record until the new one is approved. Do not delete it.

**Derive what is missing at runtime. Do not trust a list of fields from any
document, this one included.** As of 8 September 2026 the new record needs
nothing carried over: `ageRatingDeclaration` and `contentRightsDeclaration` are
both populated and match the old record. But `contentRightsDeclaration` read as
`null` on the new record earlier the same day and was set at some point between
the two reads, without anyone on the migration touching the portal, most likely
from a session in the App Store Connect UI.

That is the durable lesson rather than the field list. The portal is live and
edited by hand, so a snapshot of which fields are unset goes stale without
warning. Read the target record's state at the time you act on it.

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

**Tested, and the ids are blocked. New ids are needed.**

```
node scripts/asc-tips.mjs setup --app-id 6670502234
-> HTTP 409  ENTITY_ERROR.ATTRIBUTE.INVALID.DUPLICATE
   detail:  "This product ID has already been used"
   pointer: /data/attributes/productId
```

Cost was zero: it failed on the first create, so nothing was made. All three
remained not created on the new record afterwards, and the old record's tips
were untouched.

#### Why it was worth testing

Apple's [In-App Purchase information][iap-info] reference, the page an App Store
Commerce engineer cites when telling a developer a deleted id is gone
([thread 821022][t821022]), scopes the rule to the app, not the account: a
product ID "isn't editable after you save the In-App Purchase" and can't be
reused "within the same app, even if you delete the original In-App Purchase
with that ID." A DTS engineer repeats it verbatim in [thread 751812][t751812].
Nothing in the App Store Connect Help in-app-purchase pages, the
[configure-IAP overview][overview], [QA1329][qa1329] or TN2413 asserts an
account-wide reservation; the account-wide reading traces to
[RevenueCat's docs][rc], which cite nothing. [Thread 779431][cross-app] asks
this exact case and the reply covers only auto-renewable subscriptions.

So the documented rule left the cross-app case genuinely open, at roughly even
odds, and undecidable read-only: App Store Connect exposes no id-availability
endpoint. The test cost nothing and settled it.

#### What it settles, and what it does not

**Settles:** reusing a product id on a second app in the same account is
blocked _while another app holds that id_. RevenueCat's framing is
directionally right.

**Does not settle:** whether deleting the products from the old record would
free them. That branch never arises, since the plan keeps the old record alive,
and Apple documents that deletion does not free an id even within one app.
Record it as "blocked while another app holds them", not as "account-wide
uniqueness proven".

[iap-info]: https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-information/
[qa1329]: https://developer.apple.com/library/archive/qa/qa1329/_index.html
[overview]: https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases
[cross-app]: https://developer.apple.com/forums/thread/779431
[t821022]: https://developer.apple.com/forums/thread/821022
[t751812]: https://developer.apple.com/forums/thread/751812
[rc]: https://www.revenuecat.com/docs/getting-started/entitlements/ios-products

#### The guard still applies to the next run

`setup` is still the first irreversible call in the whole migration, and it has
**no dry run**: no `--yes` gate, no plan output. It begins creating as soon as it is
invoked. Check the branch and the ids immediately before running it, because
that is the last verifiable moment:

```bash
git rev-parse --abbrev-ref HEAD       # expect the branch carrying the decided ids
grep -n -A4 PRODUCT_IDS src/CONST.ts  # read the ids; do not trust memory
node scripts/asc-tips.mjs status --app-id 6670502234   # expect three NOT CREATED
node scripts/asc-tips.mjs setup  --app-id 6670502234
```

Whichever ids sit in the `TIPS` table at that moment are the ones created, and
they cannot be un-created. It needs no merge: a checkout of any branch does it
just as permanently.

Read the error before concluding, as above. A non-2xx is not automatically an
id conflict: `401`/`403` is key access, `404` is the wrong app id, and a `409` may
name the reference `name` field, which must also be unique, rather than the
product id. A **partial** result, some created and a later one refused, means
the rule is neither hypothesis; stop and inspect.

Since the ids are blocked:

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
