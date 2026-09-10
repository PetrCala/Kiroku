# Tip jar

The Support Kiroku screen carries a tip jar: three consumable in-app purchases
("A small beer" / "A pint" / "A round", CZK base prices 49/99/249) that let a
user say thanks. The design rules, borrowed from kyuhachi's ADR-011, are what
keep it a tip and not a paywall:

1. **A tip unlocks nothing.** No feature, no badge, no changed limit. The
   screen says so in as many words, and the App Review note repeats it.
2. **No receipt validation and no server component.** Validation protects an
   entitlement; there is none, so a forged receipt could obtain nothing.
   kiroku-api is untouched by this feature.
3. **Consumable, not non-consumable.** A tip can be given again, and there is
   nothing to restore, so the tip jar needs no Restore button (the supporter
   subscription's Restore is unrelated and unchanged).
4. **The only local state is a count of tips given** (`ONYXKEYS.TIPS_GIVEN`,
   device-level, survives sign-out), driving one thank-you line. Nothing reads
   it to decide what the user may do.

The tip jar is deliberately independent of the dormant supporter subscription:
both live on `SupportKirokuScreen`, but the subscription paywall stays hidden
in production behind `SupporterUtils.isSupporterTierVisible()` until v1.1,
while the tip jar shows in every build.

Prices are shown as the store reports them (`priceString`), already formatted
for the user's storefront and currency; the app never formats one. Tier
**names** are the app's own i18n strings, not the store's product names:
StoreKit localizes a product name by the device's App Store storefront, so a
user reading the app in Czech on a foreign storefront would otherwise get
English names. The store display names still exist (they appear in the
purchase sheet) and are kept in step by hand, in `scripts/asc-tips.mjs`, which
both `asc-tips.mjs setup` and `play.mjs tips` read.

## Why RevenueCat

kyuhachi went direct-StoreKit (`expo-iap`) because RevenueCat would have been
a new dependency for a feature with no entitlements. Kiroku is the opposite
case: `react-native-purchases` already ships in the binary for the supporter
tier, so the tip jar reuses it (`getProducts` + `purchaseStoreProduct`).
RevenueCat finishes consumable transactions itself (on Play it consumes the
purchase, which is what lets a tip be bought again), and the same code path
serves both stores. Two IAP stacks in one binary would be the only wrong
answer.

The store is optional infrastructure: if it is unreachable (web, offline,
products not yet approved), the section says so and nothing else on the
screen or in the app is affected.

## App Store Connect setup

The in-app side cannot work until the products exist and are approved in App
Store Connect; until then `fetchTipProducts` returns nothing and the section
shows its unavailable state. That is the expected state of a build made
before the steps below are done, not a bug.

To see where things stand at any point:

```bash
node scripts/asc-tips.mjs status
```

### 1. Prerequisites (once, manual)

Both fail silently: without them, products stay in **Missing Metadata** and
the store returns nothing to the app, with no error that says why.

- **Paid Applications Agreement** accepted (App Store Connect → Business →
  Agreements) and **banking + tax details** filled in. If the developer
  account already sells IAPs in another app (kyuhachi did this in Aug 2026),
  this is already done.
- Confirm enrolment in the **Small Business Program** (15% rather than 30%).

### 2. Create the products

```bash
node scripts/asc-tips.mjs setup
```

Idempotent: it skips anything that already exists. It creates each product
(consumable), the en-US + cs localizations, the territory list (mirroring the
app's own), and the CZE base price. The ids, names, descriptions, and review
note live in `scripts/asc-tips.mjs` and must match `CONST.TIPS.PRODUCT_IDS`
exactly. Only the CZE price is set by hand: Apple derives every other
territory from it. Hard-won API facts baked into the script:

- Localization names cap at 30 characters, descriptions at 45.
- **Product ids are burn-once.** The ids are `kiroku.tipjar.small_beer` /
  `.pint` / `.round`, deliberately not prefixed with the bundle id: ids are
  immutable and bundle ids are not, as the `com.kiroku.app` move proved. They
  are valid Google Play product ids too, and Play uses the same ones.
  Apple's [In-App Purchase information][iap-info]
  reference says a product ID "isn't editable after you save the In-App
  Purchase" and cannot be reused for another product "within the same app, even
  if you delete the original In-App Purchase with that ID." A typo in an id is
  therefore not fixable: the product has to be abandoned and a new id created,
  which means a new build, because the ids are compiled in. Read the table in
  `asc-tips.mjs` twice before running `setup`. Note that the rule as Apple
  words it is scoped to the app, not to the developer account; whether an id
  can be reused on a _different_ record is undocumented, which is why
  [`BUNDLE_ID_MIGRATION.md`](./BUNDLE_ID_MIGRATION.md) treats it as an open
  question rather than a settled constraint.
- A price schedule resource exists as soon as the product does, carrying no
  price; check `manualPrices`, not the schedule's existence.
- Transient 500s are normal; the script retries them.

### 3. RevenueCat

```bash
node scripts/revenuecat.mjs status                       # read-only
node scripts/revenuecat.mjs setup                        # dry run without --yes
node scripts/revenuecat.mjs set-bundle-id <bundle-id>    # dry run without --yes
```

`setup` registers the three ids as consumable products on both store apps (the
`app_store` one and the `play_store` one), with no entitlement and no offering:
a tip unlocks nothing, and `fetchTipProducts` asks the store for them by id
rather than through an offering. `status` checks the id contract against both
apps and matches each app's public SDK key to the `.env.*` files. On iOS,
purchases go through without any of this; what registering them buys is
attribution, so tip revenue reaches the charts, the exports and the webhooks.
On Android it also matters that the product is **consumable**: that is what
tells RevenueCat to consume the purchase so Play will sell the tip again.

The ids are not written in that script. It reads `CONST.TIPS.PRODUCT_IDS` out
of `src/CONST.ts`, so the RevenueCat half of the id contract cannot drift the
way a hand-copied list can. `asc-tips.mjs` still keeps its own copy, which
`play.mjs tips` refuses to use if it disagrees with `CONST`.

`set-bundle-id` changes the store id an app points at, which RevenueCat's
community answers say cannot be done and `POST /v2/projects/{id}/apps/{app_id}`
does anyway. See [`BUNDLE_ID_MIGRATION.md`](./BUNDLE_ID_MIGRATION.md) section 5,
where it moved the iOS app to `com.kiroku.app` without rotating the public SDK
key.

The script needs a RevenueCat **v2 secret key**, from
`$REVENUECAT_V2_SECRET_KEY` or a gitignored `.env.revenuecat` at the repo root.
It never prints it.

**The App Store shared secret is not part of this.** RevenueCat labels that
field "(Legacy)": it is a StoreKit 1 mechanism, and the SDK here (RevenueCat
5.72.0 via `react-native-purchases` 10) runs StoreKit 2, which validates with
the account-level In-App Purchase Key instead. Leave the field empty unless a
sandbox purchase actually fails validation, and fill it by hand if it ever
comes to that.

### 4. Review screenshot

Each product needs a review screenshot. Products in Missing Metadata ARE
returned to TestFlight builds, so the easiest source is a real screenshot of
the Support screen (Settings > Support Kiroku) from a TestFlight build. A
simulator build is not a substitute: the simulator has no App Store sandbox, so
without a StoreKit configuration file `getProducts` returns nothing and the
screenshot shows the unavailable state instead of the tiers. Then:

```bash
node scripts/asc-tips.mjs screenshot path/to/shot.png --app-id <id>          # dry run
node scripts/asc-tips.mjs screenshot path/to/shot.png --app-id <id> --yes    # upload
```

The same image goes on all three products, replacing whatever is live on them,
so the command is a dry run unless `--yes`: it prints the resize it will do and
the current screenshot state of each product first.

App Store Connect accepts review screenshots only at specific dimensions and
rejects everything else with `IMAGE_INCORRECT_DIMENSIONS`, minutes after the
upload itself reports success (the failure appears only in
`assetDeliveryState`, never as an HTTP error; `status` prints it). A phone
screenshot is not an accepted size, so the script letterboxes to 640x920
first.

### 5. Submitting

The **first** time, the products must be submitted **attached to a binary**:
selected in the version's In-App Purchases section before submitting.
Products submitted on their own sit in "Waiting for Review" indefinitely.

Note that `scripts/asc.mjs submit` currently submits app-only (that is
correct while the supporter subscriptions stay parked). The release that
carries the tip jar needs the three tip products added to the review
submission; extend `asc.mjs submit` for that release rather than submitting
by hand. The supporter subscriptions stay parked and unattached regardless:
they must not ride along until the v1.1 in-app subscription flow ships.

### 6. Testing once approved

- **Sandbox on device**: create a Sandbox Apple Account (App Store Connect →
  Users and Access → Sandbox), sign into it on the device under Settings →
  Developer → Sandbox Apple Account. Purchases are free and repeatable.
- **The unavailable path**: airplane mode + open the Support screen.

## Google Play setup

Same products, same ids, same copy. Until they exist and are active on Play,
the Android tip jar shows its unavailable state, exactly like an iOS build
before App Store Connect approval.

```bash
node scripts/play.mjs status    # the "Tip jar" block shows each id's state
```

### 1. Prerequisites

- A **payments profile** on the developer account. Play will not create any
  paid product without one; `supporter_monthly` exists, so this is done.
- The `com.android.vending.BILLING` permission in an uploaded build. It is in
  `AndroidManifest.xml` and has shipped on every internal-track build since
  the RevenueCat bootstrap.
- The fastlane service account needs the Play Console permission to manage
  products for the app. If `tips` stops with HTTP 403, that is what is
  missing (see the note at the end of this section).

### 2. Create the products

```bash
node scripts/play.mjs tips          # dry run: prints the plan and the prices
node scripts/play.mjs tips --yes    # creates and activates
```

It prompts for `LARGE_SECRET_PASSPHRASE` (hidden) to decrypt the service
account key in memory, unless the variable is already set. Idempotent: an
existing product is never repriced, only given missing listings and an
activated purchase option.

What it creates, per tip, through the one-time products API
(`monetization.onetimeproducts`):

- The id from `CONST.TIPS.PRODUCT_IDS`, and the names and descriptions from
  `scripts/asc-tips.mjs` as the en-US and cs-CZ listings (Play wants a region
  on Czech, so `cs` becomes `cs-CZ`).
- One purchase option, `tip`: a legacy-compatible buy option, so billing
  clients that predate the one-time products model still sell it.
- A price in every region. CZ is the CZK price from `asc-tips.mjs`, exactly;
  the rest come from `convertRegionPrices`, the same conversion the console
  offers. That endpoint takes a tax-exclusive price and returns tax-inclusive
  ones, while 49/99/249 Kč is what a Czech buyer pays, so the script measures
  Czech VAT with one call and converts from the matching net price with a
  second. New regions Play may launch later get the converted USD/EUR price.
- Then it activates the purchase option. Creating a product does not make it
  purchasable on its own.

Hard-won API facts baked into the script:

- **Product ids are burn-once on Play too.** A deleted id cannot be reused, so
  read the dry run before `--yes`. The script also refuses to run if the
  `asc-tips.mjs` table and `CONST.TIPS.PRODUCT_IDS` disagree.
- There is no create call. `PATCH .../onetimeproducts/{id}?allowMissing=true`
  creates, and wants `updateMask` and `regionsVersion.version` even though it
  ignores the mask when creating. The regions version comes from
  `convertRegionPrices`' response, so it is never hard-coded.
- The paths are not consistently cased: `patch` is `/onetimeproducts/{id}`,
  while `list`, `get` and `purchaseOptions:batchUpdateStates` are
  `/oneTimeProducts/...`. The reference pages disagree with each other; the
  discovery document is what the script follows.
- If the one-time products API is unavailable for the app, `tips` falls back
  to the legacy `inappproducts` API, with a CZK default price and Play's
  automatic conversion for the rest.

### 3. RevenueCat

`node scripts/revenuecat.mjs setup` (step 3 of the App Store section) covers
the Android app as well. Run it after `play.mjs tips`, then `status` to see the
`Kiroku (Android)` tip contract all OK.

RevenueCat answers the `consumable` create with a `one_time` product on the
Play app: it has no separate consumable type for Play. That is fine, because
on Android RevenueCat consumes every one-time purchase unless the product is
marked `non_consumable`. The test purchase below is what proves it.

### 4. The Android SDK key

Android release builds are the Production flavor (`build_beta` runs
`bundleProductionRelease`), so they read `.env.production`, which CI writes
from the `PRODUCTION_ENV_FILE` secret. It must hold
`REVENUECAT_ANDROID_API_KEY=goog_...`, the public SDK key of the RevenueCat
Android app. Without it `Subscriptions.initialize` leaves the SDK off and the
tip jar shows its unavailable state. `revenuecat.mjs status --env-dir <main
checkout>` shows which local `.env.*` files carry it. GitHub secrets cannot be
read back, so after changing the local file, re-upload it:

```bash
gh secret set PRODUCTION_ENV_FILE < .env.production
```

The next staging build picks it up.

### 5. Testing on the internal track

- Add the tester's Google account under **License testing** (Play Console
  home, Settings → License testing). License testers pay with test
  instruments ("Test card, always approves") and are never charged.
- The same account has to be on the internal testing track's tester list and
  install the build from the Play Store (the track's opt-in link).
- Open Settings → Support Kiroku. The three tiers should show Play's prices.
  New products can take a little while to reach a device.
- Buy one tier, then **buy the same tier again**. The second purchase going
  through is the proof that RevenueCat consumed the first; if it had not,
  Play would answer "You already own this item". Both show as test orders in
  Play Console → Order management.

## What is deliberately absent

- No receipt validation, no server, no RTDB write (rule 2 above).
- No Restore Purchases button for tips (consumables are not restorable).
- No App Privacy change: Apple handles the transaction; the app stores only
  a local count of tips given, which never leaves the device.

[iap-info]: https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-information/
