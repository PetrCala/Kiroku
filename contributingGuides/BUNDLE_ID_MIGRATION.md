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

### 3. Firebase

The three `ios/config/GoogleService-Info.*.plist` files are deliberately
untouched: they are generated, and `GOOGLE_APP_ID`, `CLIENT_ID` and
`REVERSED_CLIENT_ID` all change together with `BUNDLE_ID`. Hand-editing only
`BUNDLE_ID` produces a config that looks right and misroutes at runtime.

`API_KEY` is the exception: it is the project's shared
`iOS key (auto created by Firebase)`, reused by every iOS app in the project, so
it survives the move. Do not read an unchanged `API_KEY` as a sign that the
download failed.

#### 3.1 Register the apps (Petr, one command each)

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

`apps:create` prints the new `GOOGLE_APP_ID`. Feed each one straight back:

```bash
firebase apps:sdkconfig IOS <prodAppId>  --project alcohol-tracker-db     -o ios/config/GoogleService-Info.prod.plist
firebase apps:sdkconfig IOS <devAppId>   --project dev-alcohol-tracker-db -o ios/config/GoogleService-Info.dev.plist
firebase apps:sdkconfig IOS <adhocAppId> --project dev-alcohol-tracker-db -o ios/config/GoogleService-Info.adhoc.plist
```

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
- [ ] **`GOOGLE_IOS_CLIENT_ID` in the env files.** The one Firebase value the
      app does not read from a plist. `CONFIG.GOOGLE_SIGN_IN.IOS_CLIENT_ID`
      ([`src/CONFIG.ts`](../src/CONFIG.ts)) feeds `GoogleSignin.configure` in
      [`src/libs/OAuthCredential/index.ios.ts`](../src/libs/OAuthCredential/index.ios.ts),
      and it is sourced from the environment, which comes from the four
      `*_ENV_FILE` GitHub secrets (`DEV`, `STAGING`, `PRODUCTION`, `ADHOC`). It
      holds the same value as the plist's `CLIENT_ID`, so it is bundle-bound and
      must be rotated to the new apps' client ids in every affected secret.

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

**Test whether new ids are needed before assuming they are.** Apple's no-reuse
rule is documented as scoped within an app, not across an account; the
account-wide reading traces to third-party sources citing nothing. So the four
existing ids (`kiroku.tip.small_beer`, `kiroku.tip.pint`, `kiroku.tip.round`,
`supporter_lifetime`) may simply work on the new record.

The test is `setup` itself, run with the **current** ids. On success it creates
all three and continues into localizations, territories and price, finishing
this section outright. On an id conflict it fails on the first create, having
made nothing.

This is the first irreversible call in the whole migration, and `setup` has **no
dry run**: no `--yes` gate, no plan output. It begins creating as soon as it is
invoked. Check the branch and the ids immediately before running it, because
that is the last verifiable moment:

```bash
git rev-parse --abbrev-ref HEAD       # expect feat/ios-bundle-id-com-kiroku-app
grep -n -A4 PRODUCT_IDS src/CONST.ts  # expect the CURRENT kiroku.tip.* ids
node scripts/asc-tips.mjs status --app-id 6670502234   # expect three NOT CREATED
node scripts/asc-tips.mjs setup  --app-id 6670502234
```

Running this from a branch that already carries renamed ids burns the new ids
without ever testing the old ones, which is the failure worth guarding against.
It needs no merge: a checkout of the rename branch does it just as permanently.

Read the error before concluding. A non-2xx is not automatically an id
conflict: `401`/`403` is key access, `404` is the wrong app id, and a `409` may
name the reference `name` field, which must also be unique, rather than the
product id. A **partial** result, some created and a later one refused, means
the rule is neither hypothesis; stop and inspect.

If the ids are genuinely blocked:

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
