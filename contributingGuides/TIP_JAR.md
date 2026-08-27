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
English names. The App Store Connect display names still exist (they appear in
the purchase sheet) and are kept in step by hand, in `scripts/asc-tips.mjs`.

## Why RevenueCat

kyuhachi went direct-StoreKit (`expo-iap`) because RevenueCat would have been
a new dependency for a feature with no entitlements. Kiroku is the opposite
case: `react-native-purchases` already ships in the binary for the supporter
tier, so the tip jar reuses it (`getProducts` + `purchaseStoreProduct`).
RevenueCat finishes consumable transactions itself, and the same code path
will cover Google Play when the tip jar comes to Android. Two IAP stacks in
one binary would be the only wrong answer.

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
- A price schedule resource exists as soon as the product does, carrying no
  price; check `manualPrices`, not the schedule's existence.
- Transient 500s are normal; the script retries them.

### 3. RevenueCat dashboard

Add the three product ids as **non-subscription products** in the RevenueCat
project (no entitlement, no offering needed). Purchases go through without
this, but registering them keeps RevenueCat's charts and webhooks aware of
tip revenue.

### 4. Review screenshot

Each product needs a review screenshot. Products in Missing Metadata ARE
returned to TestFlight builds, so the easiest source is a real screenshot of
the Support screen from a TestFlight build. Then:

```bash
node scripts/asc-tips.mjs screenshot path/to/shot.png
```

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

## What is deliberately absent

- No receipt validation, no server, no RTDB write (rule 2 above).
- No Restore Purchases button for tips (consumables are not restorable).
- No App Privacy change: Apple handles the transaction; the app stores only
  a local count of tips given, which never leaves the device.
