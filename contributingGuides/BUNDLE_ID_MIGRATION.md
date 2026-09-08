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
identity to carry forever, and because it is cheapest now, while there is no iOS
release, no ratings and no purchase history to strand. Do not do it expecting
review to behave differently afterwards.

There are users, despite what an earlier draft of this guide said: 700 accounts
reach Kiroku through Android and the web, and none of them are affected by an
iOS bundle id. See Fallout.

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

### 3. Firebase

The three `ios/config/GoogleService-Info.*.plist` files are deliberately
untouched: they are generated, and `GOOGLE_APP_ID`, `CLIENT_ID` and
`REVERSED_CLIENT_ID` all change together with `BUNDLE_ID`. Hand-editing only
`BUNDLE_ID` produces a config that looks right and misroutes at runtime.

`API_KEY` is the exception: it is the project's shared
`iOS key (auto created by Firebase)`, reused by every iOS app in the project, so
it survives the move. Do not read an unchanged `API_KEY` as a sign that the
download failed.

#### 3.1 Register the apps

New app entries, not edits. `bundleId` is `Immutable` in the Firebase Management
API (`displayName`, `appStoreId`, `teamId` and `apiKeyId` are not), so an
existing iOS app cannot be renamed onto the new id.

That is a smaller change than it sounds. Everything keyed to the _project_
survives untouched: all auth accounts and their linked providers, Realtime
Database, Storage, the auth provider configs, the APNs auth key, and the shared
iOS API key. Only what is keyed to the _app entry_ is recreated: `GOOGLE_APP_ID`,
the iOS OAuth client (`CLIENT_ID` / `REVERSED_CLIENT_ID`), APNs certificates if
the project uses those instead of a key, and the Crashlytics and Analytics
streams. A second app in the same project does get its own OAuth client, which
is why `Kiroku Dev` and `Kiroku AdHoc` already have different client ids.

Registering them is additive: the old entries keep serving current builds, so
nothing cuts over until a build ships with the new plists.

The `firebase` CLI does the whole thing. It creates the app and prints the
finished plist, so nothing in this step needs the console:

```bash
firebase apps:create IOS "Kiroku"           --project alcohol-tracker-db     --bundle-id com.kiroku.app       --app-store-id 6670502234
firebase apps:create IOS "Kiroku Dev"       --project dev-alcohol-tracker-db --bundle-id com.kiroku.app
firebase apps:create IOS "Kiroku AdHoc"     --project dev-alcohol-tracker-db --bundle-id com.kiroku.app.adhoc
```

**Done on 8 September 2026.** The three apps exist:

| Variant | `GOOGLE_APP_ID`                             | Bundle id              |
| ------- | ------------------------------------------- | ---------------------- |
| prod    | `1:665512857657:ios:0f12781cf0885f4fb4fde8` | `com.kiroku.app`       |
| dev     | `1:806896865950:ios:3e6a198144a6d4cbb1618f` | `com.kiroku.app`       |
| adhoc   | `1:806896865950:ios:1491725d909b20a8b1618f` | `com.kiroku.app.adhoc` |

`apps:create` prints that id. Feed each one back to download the config.
`apps:sdkconfig -o` **refuses to overwrite an existing file**, so write to a
temporary path and move it in, rather than pointing `-o` at the committed plist:

```bash
firebase apps:sdkconfig IOS <prodAppId>  --project alcohol-tracker-db     -o /tmp/prod.plist
firebase apps:sdkconfig IOS <devAppId>   --project dev-alcohol-tracker-db -o /tmp/dev.plist
firebase apps:sdkconfig IOS <adhocAppId> --project dev-alcohol-tracker-db -o /tmp/adhoc.plist
for f in prod dev adhoc; do mv "/tmp/$f.plist" "ios/config/GoogleService-Info.$f.plist"; done
```

Each app had its OAuth client provisioned by the time `apps:create` returned, so
the wait warned about in 3.2 did not materialise. `API_KEY` came back unchanged
on both projects, as expected.

Then propagate the `REVERSED_CLIENT_ID` values into the `CFBundleURLSchemes`
array in [`ios/kiroku/Info.plist`](../ios/kiroku/Info.plist):

```bash
npm run sync-ios-url-schemes
```

Commit the four changed files together. Google Sign-In breaks silently when the
schemes and the configs disagree, so
[`scripts/sync-ios-url-schemes.mjs`](../scripts/sync-ios-url-schemes.mjs) owns
that array now: it writes the schemes in prod/dev/adhoc order,
`--check` exits non-zero on drift, and `npm test` runs that check.

Notes on the CLI:

- `apps:sdkconfig` output is byte-equivalent to the console download apart from
  an extra `ANDROID_CLIENT_ID` key, which is harmless.
- `apps:list` does not print bundle ids. To confirm which app is which:
  `curl -H "Authorization: Bearer $(gcloud auth print-access-token)" https://firebase.googleapis.com/v1beta1/projects/<projectId>/iosApps`.
- The old apps stay registered and keep working. Do not delete them until the
  new record is approved.
- `--app-store-id` is cosmetic (it drives the Firebase console's App Store link)
  and only the prod app has one.
- Auth users are keyed to the Firebase project rather than the iOS app, so
  email/password and Google accounts survive. **Sign in with Apple does not**:
  see the scoping note in section 2, which has to be decided before
  `app-setup --yes` rather than here. 3.2 carries the command that answers it.

#### 3.2 What a fresh plist does not carry

A new app entry starts blank on everything the console stores next to it rather
than inside the plist. Each of these fails silently: no build error, no crash,
just a feature that stops working on the new bundle id.

- [ ] **OAuth client exists.** `apps:create` provisions the iOS OAuth client
      asynchronously. If `apps:sdkconfig` returns a plist with no
      `REVERSED_CLIENT_ID`, wait and re-run rather than committing it;
      `npm run sync-ios-url-schemes` refuses that plist with a named error.
- [ ] **APNs credential.** Console → Project settings → Cloud Messaging. An APNs
      **auth key** (`.p8`) is stored per project and applies to every iOS app in
      it, so it carries over untouched. An APNs **certificate** is stored per
      app and does not: if either project is on certificates, upload one for
      each new app entry. Push is a real entitlement here
      ([`ios/kiroku/kiroku.entitlements`](../ios/kiroku/kiroku.entitlements)
      declares `aps-environment`), so verify by sending a test push to a build
      signed with the new id, not by reading the console.
- [ ] **Sign in with Apple: the audience.** The provider config is
      project-level (team id, key id, private key, Services ID) and is already
      enabled on both projects with the shared team key, so nothing needs
      re-entering. What is per-app is the audience: Firebase validates the `aud`
      of Apple's identity token against the bundle ids of the iOS apps
      registered in the project. Native Apple Sign-In therefore fails on
      `com.kiroku.app` until step 3.1 is done, and starts working once it is.
      Test it on a device before shipping.
- [ ] **Count the Apple-linked accounts, before section 2.** Section 2's
      `app-setup --yes` decides whether `com.kiroku.app` becomes its own Sign in
      with Apple primary, and that choice only costs anything if `apple.com`
      accounts already exist. The number is knowable, so measure it rather than
      assuming it is small:

      ```bash
      firebase auth:export /tmp/users.json --format=json --project alcohol-tracker-db
      jq '[.users[] | select(.providerUserInfo // [] | any(.providerId == "apple.com"))] | length' /tmp/users.json
      rm /tmp/users.json
      ```

      Repeat with `--project dev-alcohol-tracker-db`. The export contains real
      user records, so write it outside the repo and delete it afterwards. The
      console's Authentication user list answers the same question by eye if you
      would rather not have the file at all.

      Measured on 8 September 2026: **zero** on both projects, out of 637
      accounts on `alcohol-tracker-db` and 63 on `dev-alcohol-tracker-db`. On
      that number the primary-versus-grouped choice strands nobody and the
      default is fine. Re-run it immediately before `--yes` rather than trusting
      this line; one TestFlight tester tapping the Apple button changes the
      answer.

- [ ] **The Apple Services ID is stale but fine.** Both projects have the
      provider's `clientId` set to
      `org.reactjs.native.example.alcohol-tracker.signin.webandroid`, which is a
      Services ID in the Apple developer portal, not a bundle id. It backs the
      web and Android code flow only. It keeps working under its current name;
      renaming it means creating a new Services ID and re-pointing both
      projects, which is cosmetic and best left out of this migration.
- [x] **`GOOGLE_IOS_CLIENT_ID` in the env files.** Rotated 8 September 2026. The one Firebase value the
      app does not read from a plist. `CONFIG.GOOGLE_SIGN_IN.IOS_CLIENT_ID`
      ([`src/CONFIG.ts`](../src/CONFIG.ts)) feeds `GoogleSignin.configure` in
      [`src/libs/OAuthCredential/index.ios.ts`](../src/libs/OAuthCredential/index.ios.ts),
      and it is sourced from the environment, which comes from the four
      `*_ENV_FILE` GitHub secrets. It holds the same value as the plist's
      `CLIENT_ID`, so it is bundle-bound and must be rotated.

      Which secret needs which value follows from the Xcode configuration that
      each build uses, since that is what selects the bundled plist (the
      `[User] Copy GoogleService-Info.plist` build phase):

      | Secret               | Build                                | Plist   |
      | -------------------- | ------------------------------------ | ------- |
      | `PRODUCTION_ENV_FILE` | `Kiroku (production)` scheme, iOS release | prod  |
      | `ADHOC_ENV_FILE`      | `Kiroku (AdHoc)` scheme                   | adhoc |
      | `DEV_ENV_FILE`        | local `Debug` / `Development`             | dev   |
      | `STAGING_ENV_FILE`    | web only, no iOS plist involved            | n/a   |

      Read the value to paste out of the plist itself rather than copying it
      from here, so it cannot drift:

      ```bash
      for f in prod dev adhoc; do
        printf '%s\t' "$f"
        plutil -extract CLIENT_ID raw "ios/config/GoogleService-Info.$f.plist"
      done
      ```

      `PRODUCTION_ENV_FILE`, `DEV_ENV_FILE` and `ADHOC_ENV_FILE` now carry the
      new client ids. `STAGING_ENV_FILE` was deliberately left alone: no iOS
      build reads it, so its `GOOGLE_IOS_CLIENT_ID` is inert, and rewriting a
      secret that feeds the staging web deploy for no functional gain is not
      worth the risk. It still holds the retired prod client id.

      GitHub secrets are write-only, so rotating one means re-uploading the
      whole file and trusting the local copy. That was checked rather than
      assumed: every distinctive value in the local `.env.production` and
      `.env.development` appears in the deployed bundles at
      `kiroku-app-prod.web.app` and `kiroku-app-dev.web.app`, which is what
      confirms the local files still matched the secrets. Do the same check
      before any future rotation.

      One pre-existing bug fell out of this. `.env.adhoc` held the **dev** app's
      client id, not the ad-hoc one, left over from when the ad-hoc build fell
      back to the dev plist (see the fallback still in the
      `[User] Copy GoogleService-Info.plist` build phase). Ad-hoc Google Sign-In
      was pointed at the wrong OAuth client before this migration started. It is
      correct now.

      `sync-ios-url-schemes.mjs` does **not** cover this. It guards the
      `REVERSED_CLIENT_ID` copy in `Info.plist`; this is a different value in a
      place that is not in the repo at all, so nothing local can be compared
      against it. Miss it and Google Sign-In fails on first tap, on a build that
      went green through CI.

- [ ] **The Crashlytics app id in the Fastfile.**
      [`fastlane/Fastfile:372`](../fastlane/Fastfile) passes
      `app_id: "1:665512857657:ios:a07eeddf1f54bac2b4fde8"` to
      `upload_symbols_to_crashlytics`, byte-identical to the current prod
      plist's `GOOGLE_APP_ID`. After 3.1 it points at the retired Firebase app,
      so every dSYM upload lands on a dead Crashlytics record. The call is
      wrapped in a `rescue` that only logs and continues, so it will not fail
      the lane. The same call already passes
      `gsp_path: "./ios/config/GoogleService-Info.prod.plist"`, which carries
      the correct id, so deriving `app_id` from that plist (or dropping the
      argument) is the durable fix; otherwise rotate it by hand here.
- [ ] **API key bundle-id allowlist.** Nothing to do. Both projects' iOS keys
      are restricted by API target only, with an empty allowed-bundle-ids list,
      so a new bundle id needs no entry. Confirm it stayed that way with
      `gcloud services api-keys list --project <projectId> --format="table(displayName, restrictions.iosKeyRestrictions.allowedBundleIds.list())"`
      If that column is ever non-empty, add both new ids before shipping.
- [ ] **App Check.** Not enforced today: no service has enforcement configured
      on `alcohol-tracker-db`, and the App Check API is not even enabled on
      `dev-alcohol-tracker-db`. If it is ever turned on, the attestation
      provider is registered per app, and a new app entry starts unattested and
      fails closed on every request.
- [ ] **Crashlytics / Analytics history.** A new app id is a new stream. Old
      crash and event data stays on the old entry and does not migrate. Nothing
      to fix, just do not read the empty dashboards as breakage.

#### 3.3 Verify

- [ ] `npm run sync-ios-url-schemes -- --check` passes.
- [ ] All three plists carry the new `BUNDLE_ID` and no file in the repo still
      matches `org.reactjs.native.example`:
      `git grep -l 'org\.reactjs\.native\.example'` returns nothing.
- [ ] `GOOGLE_IOS_CLIENT_ID` in all four `*_ENV_FILE` secrets matches the
      `CLIENT_ID` of the plist that ships with that variant.
- [ ] `fastlane/Fastfile` no longer names the retired Crashlytics app id.
- [ ] Google Sign-In completes on a device build of each variant. This is the
      check that catches a missed `GOOGLE_IOS_CLIENT_ID`; CI cannot.
- [ ] Apple Sign-In completes on a device build, and section 2's
      primary-versus-grouped decision was made against a fresh count, not
      inherited from the dry run.
- [ ] A test push arrives on a device build.
- [ ] A dSYM upload lands on the new Crashlytics record, not the old one. The
      Fastfile swallows this failure, so read the lane log rather than its exit
      code.

### 4. The App Store Connect record

Rename the old record to free the name, then rename `Kiroku Placeholder` to
`Kiroku`. That step stays manual: App Store names are unique per account, so
the new record cannot take `Kiroku` while the old one holds it. Whether the old
record's `WAITING_FOR_REVIEW` `appInfo` additionally blocks the edit is inferred
rather than tested, as section 1 sets out. Either way the name gets settled in
the portal on its own.

`clone-listing` carries the rest of the listing across, a dry run until `--yes`:

```bash
node scripts/asc.mjs clone-listing --from 6466886157 --to 6670502234        # plan
node scripts/asc.mjs clone-listing --from 6466886157 --to 6670502234 --yes  # apply
```

It copies the app info localizations (subtitle, privacy policy URL) for every
locale on the old record, the version localizations (description, keywords,
promotional text, what's new, marketing and support URLs), the primary and
secondary categories, `contentRightsDeclaration`, the age rating declaration,
the version copyright and release type, and the review detail including the
demo account. Locales the new record does not have yet are created rather than
skipped, taking the new record's own name. It never writes the app name.

Both records are read on every run, so the plan and the closing
`SUBMISSION BLOCKERS` block describe the portal as it is at that moment rather
than as anything written down here. A single attribute ASC rejects would
otherwise take the rest of its request with it, including the privacy policy
URL that submission requires, so the write is retried once without the rejected
attribute and the dropped field is reported under `PARTIALLY COPIED`.

What `clone-listing` does not copy, and the report says so:

- **The app name**, for the reason above.
- **Screenshots.** Regenerate with `npm run frame-screenshots` and upload with
  `node scripts/asc.mjs shots --dir <folder> --locale <loc> --replace --yes`,
  one run per locale. See [`SCREENSHOTS.md`](./SCREENSHOTS.md). All three build
  schemes embed `Kiroku Watch App.app`, so the new record needs the
  `APP_WATCH_SERIES_4` slot (368x448) filled as a submission prerequisite, not
  as an optional extra. Upload exactly one watch size: a version may carry only
  one watch display type, and a second set fails with HTTP 409. Capturing it
  means running
  [`screenshots.yml`](../.github/workflows/screenshots.yml) with `capture_watch`
  on rather than the phone matrix alone; that job gates itself with
  `verify-captured-screenshots.mjs --require watch`.
- **App Privacy (the nutrition labels).** The API does not expose it at all:
  there is no `appDataUsages` resource and no `appPrivacyDetails` relationship,
  both 404. Re-answer it by hand in ASC, matching the old record question for
  question.
- **Pricing and availability**, and the in-app purchases (section 5).
- **TestFlight groups and testers.** A new record starts with neither. The
  `Beta` group that the `production` lane distributes to
  ([`fastlane/Fastfile:396`](../fastlane/Fastfile), `:399`:
  `distribute_external: true`, `groups: ["Beta"]`) has to be recreated on
  `6670502234` and the testers re-invited, or the first upload lands with
  nobody able to install it. The first external build on the new record also has
  to clear Beta App Review again, which the `beta_app_review_info` block at
  `:401` already supplies.

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
node scripts/asc.mjs rename --app-id 6670502234 --to 0.3.24        # plan
node scripts/asc.mjs rename --app-id 6670502234 --to 0.3.24 --yes  # do it
```

`--version` defaults to the lone `PREPARE_FOR_SUBMISSION` version, which is the
`1.0` one. Like `submit` and `shots`, `rename` is a dry run until `--yes`: the
first form prints the app, the version it resolved and the target string
without touching anything.

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

#### The new ids: `kiroku.tipjar.*`

`kiroku.tipjar.small_beer` / `.pint` / `.round`. Chosen deliberately, not
inherited from the bundle-id rename that prompted this:

- **Bundle-independent.** `com.kiroku.app.tip.*` would bake a mutable string
  into a permanently immutable one, and this migration is the proof that a
  bundle id can change while product ids cannot follow. QA1329's reverse-DNS
  advice is about avoiding collisions, which the `kiroku.` prefix already does
  against the other apps in this account.
- **Store-independent.** The same ids are intended for Google Play when the tip
  jar reaches Android, where the iOS bundle id is meaningless (`applicationId`
  is `com.alcohol_tracker`). `kiroku.tipjar.*` is a valid Play product id
  as-is, and Play refuses to reuse an id once created, exactly as Apple does.
- **Not confusable with the burned ids.** `kiroku.tips.*` would sit one
  character from the dead `kiroku.tip.*`, which stays on the old record, in
  RevenueCat and in this repo's history. `tipjar` cannot be misread.
- **Named as the codebase names the feature** (`TIP_JAR.md`, `TipJarUtils`,
  `supporter.tipJar.*`), and distinct from the dormant supporter subscription
  on the same screen, which `kiroku.support.*` would have blurred.

Since the ids are blocked:

1. Done in code: `CONST.TIPS.PRODUCT_IDS` in [`src/CONST.ts`](../src/CONST.ts)
   and the `TIPS` table in [`scripts/asc-tips.mjs`](../scripts/asc-tips.mjs).
   They must match exactly, as must the `getTipLabel` switch in
   `SupportKirokuScreen` and the docblock in `src/libs/TipJarUtils.ts`. The
   locale files need nothing: tier names are keyed as `supporter.tipJar.tier*`,
   not by product id.
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

## Cross-cutting gaps found by audit

Things a bundle-id change breaks that are not visible from the numbered steps
above. Each still builds, still passes CI, and only misbehaves once the app runs
under the new identity. They are collected here rather than edited into steps 2
and 4, which are owned by other lanes; the owner of each should fold theirs in.

Re-checked against the tree on 8 September 2026, and the line anchors are from
that reading. Five earlier findings have been dropped from this list because
their owning sections now carry them, in more detail than the audit did.
Section 3 took the `GOOGLE_IOS_CLIENT_ID` env-secret rotation, the Crashlytics
app id in the Fastfile, and the count of Sign in with Apple accounts. Section 4
took the mandatory `APP_WATCH_SERIES_4` screenshot slot and the TestFlight
groups and testers that do not transfer, both folded into the `clone-listing`
checklist where someone executing that step will meet them.

### Belongs in step 2 (signing)

#### `Kiroku_Development` is outside the minted set, and it breaks

The `Debug`, `DebugDevelopment` and `DebugProduction` configs pin
`PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*] = Kiroku_Development`
(`ios/kiroku.xcodeproj/project.pbxproj:1558`, `:1773`, `:2899`), and the
committed `ios/Kiroku_Development.mobileprovision.gpg` is bound to the old App
ID. Nothing in step 2 re-mints it: it is absent from the `PROFILES` table
(`scripts/ios-signing.mjs:173-204`), `app-setup` re-mints only `Kiroku`, and the
skill puts it out of scope
([`.claude/skills/ios-signing/SKILL.md:144`](../.claude/skills/ios-signing/SKILL.md)).
The watch equivalent is handled, which is what makes the gap easy to miss:
`watch-setup` mints `KirokuWatch_Development` from its own `WATCH_DEV_PROFILE`
entry (`scripts/ios-signing.mjs:207-212`). The phone one has no such path.

So local on-device Debug builds stop signing after the move, until you either
create a development profile for `com.kiroku.app` in Xcode or switch those three
configs to `CODE_SIGN_STYLE = Automatic`, which is what `DebugAdHoc` already did
for a related reason ([`IOS_ADHOC_COEXIST.md:40-45`](./IOS_ADHOC_COEXIST.md)).
CI is unaffected: it builds the AdHoc and production configs only. The skill's
out-of-scope note says to renew this profile by hand when it expires, but not
that a bundle-id change invalidates it, which is what happens here.

### Belongs in step 4 (the App Store Connect record)

#### `clone-listing` is not the only thing writing the listing

Section 4 copies the listing across with `clone-listing`, from the old record.
Fastlane writes most of the same fields from the repo, and nothing sequences the
two. The `production` and `upload_metadata` lanes both run `deliver` with
`skip_metadata: false` and `metadata_path: "./fastlane/metadata"`
([`fastlane/Fastfile:415-446`](../fastlane/Fastfile), `:546-563`), so name,
subtitle, keywords, description, promotional text, the three URLs, copyright,
the age-rating questionnaire (`rating_config.json`, via
`app_rating_config_path`) and the review contact plus demo account are all
pushed from [`fastlane/metadata`](../fastlane/metadata), in both `en-US` and
`cs`. The Appfile already resolves to `com.kiroku.app`, so those lanes target
the new record with no further change and no further prompting.

Two consequences.

**The name.** `clone-listing` deliberately never writes the app name, but
`deliver` does: `fastlane/metadata/en-US/name.txt` is `Kiroku`. So the first
`upload_metadata` or `production` run against the new record fails on the name
collision unless the old record has already given the name up. That is the same
lock section 1 describes, reached by a path section 4 does not mention.

**Whichever runs last wins.** For every field both mechanisms write, the old
record's value and the repo's value are not guaranteed to agree, and the loser
is silent. If they have drifted, the repo is the one under version control and
should be treated as the source; run `upload_metadata` after `clone-listing`
rather than before, and read its diff.

## Fallout

TestFlight testers install a new app rather than updating, because a different
bundle id is a different app. The review clock restarts. There are no ratings
and no purchase history to carry over, because the app has never been released
on the App Store.

**"No production users" is false, and the risk conclusions survive on a
different reason.** There are 700 accounts: 637 on `alcohol-tracker-db` and 63
on `dev-alcohol-tracker-db`, counted 8 September 2026 (see 3.2). They reach
Kiroku through Android and the web. The iOS bundle id is meaningless on both:
Android's `applicationId` is `com.alcohol_tracker` and is not changing, and the
web build has no bundle id at all. So nothing in this migration touches those
accounts, but the reason is that they are not on iOS, not that they do not
exist.

The ad-hoc PR builds behave like the App Store one: `com.kiroku.app.adhoc` lands
as a second icon next to whatever `…alcohol-tracker.adhoc` a tester already has,
rather than replacing it. Tell testers to delete the old ones.

**Local state does not survive, and some of it is nowhere else.** The exposed
population today is TestFlight testers, so this is cheap now; the same mechanism
would be serious after an iOS release. A fresh install starts with an empty Onyx
store, and four keys hold data that exists only on the device at the moment of
the cut-over:

| Key                                               | What is lost                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `ONGOING_SESSION_DATA` (`src/ONYXKEYS.ts:108`)    | The live session buffer, including drinks the debounced persist never flushed |
| `ONGOING_SESSION_SYNC` (`src/ONYXKEYS.ts:115`)    | The stamps that tell the next launch those edits were never enqueued          |
| `UNSYNCED_SESSION_WRITES` (`src/ONYXKEYS.ts:122`) | Parked finalize writes waiting for the boot re-send                           |
| `PERSISTED_REQUESTS` (`src/ONYXKEYS.ts:21`)       | The offline request queue                                                     |

The live persist deliberately writes no optimistic snapshot, so the sync marker
is "the only record that the hydrated `ONGOING_SESSION_DATA` buffer holds edits
the server has never seen"
([`DrinkingSession.ts:50-53`](../src/libs/actions/DrinkingSession.ts)). A tester
who has a session open, or who ended one while offline, loses those drinks with
no error and no way to notice. Ask testers to close and sync any open session
before installing the new app, and do the cut-over when nobody is mid-session.

Everything else re-hydrates: profile, sessions, preferences, theme and locale
are all server-side (`user_preferences/$uid` via kiroku-api).

## Doc drift the rename left behind

Mechanical, harmless to the build, and wrong if read literally:

- [`.claude/skills/ios-signing/SKILL.md:111-113`](../.claude/skills/ios-signing/SKILL.md)
  still lists the watch App IDs as `…alcohol-tracker.watchkitapp` /
  `…alcohol-tracker.adhoc.watchkitapp`.
- [`docs/apple-watch-mvp.md:33-35`](../docs/apple-watch-mvp.md) says all three
  schemes build only `kiroku` + `kirokuTests` and that no scheme builds the
  watch app. All three do build it, which is what makes the watch screenshot
  mandatory above.
- [`docs/apple-watch-mvp.md:38`](../docs/apple-watch-mvp.md) gives the watch
  bundle id as `com.kiroku.app.watch`. The real one is
  `com.kiroku.app.watchkitapp`, as the same file says at `:125-126`; the
  find-and-replace preserved a pre-existing error.
- [`contributingGuides/IOS_ADHOC_COEXIST.md:7-10`](./IOS_ADHOC_COEXIST.md) now
  reads "until this change every device configuration resolved to the same
  bundle id (`com.kiroku.app`)", which rewrites history: that sentence is about
  the state _before_ the ad-hoc split, when the shared id was
  `org.reactjs.native.example.alcohol-tracker`.
- [`docs/app-store-submission-kit.md:36`](../docs/app-store-submission-kit.md)
  still names `6466886157` as "the app record".
- [`e2e/native/README.md:78`](../e2e/native/README.md) and
  [`e2e/native/flows/sign_in_log_session.yaml:11`](../e2e/native/flows/sign_in_log_session.yaml)
  tell you to set `MAESTRO_APP_ID=com.alcohol_tracker.dev` and "confirm the iOS
  bundle id". On iOS it is now `com.kiroku.app`.

## Rolling back

The code half is one revert. The portal half is not destructive: the old App
IDs, profiles and app record all survive, so reverting the commit and re-running
the three signing commands with the old `--bundle-id` restores the previous
state.
