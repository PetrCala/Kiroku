# Kiroku — App Store Submission Kit

> Prepared for Kiroku's **first App Store submission** (issue #648, 🟡 section).
> Repo audited at master `0.3.13-36` on 2026-05-28.
>
> **This is a paste/upload kit.** Claude cannot perform the App Store Connect (ASC) work — that is a manual, authenticated task only Petr can do with his Apple credentials. Every section below is a draftable input ready to paste into ASC, plus a click-by-click walkthrough.
>
> **The single most important rule:** frame Kiroku consistently as an alcohol-**tracking / self-awareness / harm-reduction** tool. NEVER as something that encourages, gamifies, or celebrates drinking. This framing is the biggest concept-rejection risk (App Review Guideline 1.4.3 — apps encouraging excessive consumption of alcohol are rejected). The copy below is written to be defensible on that axis.

---

## 1. App Store listing copy

Product reference identifiers (confirmed in code):
- Monthly subscription product ID: **`supporter_monthly`** (`src/screens/Settings/ManageSubscriptionScreen.tsx:24`, `src/libs/SupporterUtils.ts:7`)
- RevenueCat entitlement: **`supporter`** (`src/libs/actions/Subscriptions.ts:18`)

### 1a. English (primary)

**App Name** (max 30 chars)
```
Kiroku: Alcohol Tracker
```
*(23 chars)*

**Subtitle** (max 30 chars)
```
Track & understand drinking
```
*(27 chars)*

**Promotional text** (max 170 chars — editable any time without re-review)
```
Log every drink, see your patterns, and build awareness of your alcohol habits. Private, offline-first, and judgment-free. Take charge of your own data.
```
*(151 chars)*

**Keywords** (max 100 chars, comma-separated, NO spaces after commas to save characters)
```
alcohol,drink,tracker,sobriety,habit,health,units,diary,log,awareness,mindful,calendar,stats,intake
```
*(99 chars)*

**Description** (full)
```
Kiroku helps you track and understand your alcohol consumption — so you can make informed decisions about your own habits.

This is a personal tracking and self-awareness tool, not a drinking companion. Kiroku is built around harm reduction: the more clearly you see your own patterns, the easier it is to set goals, notice trends, and cut back when you want to.

WHAT YOU CAN DO
• Log drinking sessions in real time or add them later
• Record drink types and standardized units per session
• Add notes to remember the context of a session
• Browse your full history in a monthly calendar
• See statistics and trends: totals, units over time, alcohol-free days, patterns, and breakdowns
• Track alcohol-free days to celebrate the days you didn't drink

PRIVATE BY DESIGN
• Offline-first: the app works without a connection and syncs when you're back online
• Your data is yours — view, edit, and delete sessions any time
• Delete your account and data from within the app at any time

STAY CONNECTED (OPTIONAL)
• Add friends to share progress and support each other
• See a friend's supporter badge

KIROKU SUPPORTER (OPTIONAL SUBSCRIPTION)
Kiroku is free to use. If you'd like to support development, "Kiroku Supporter" is an optional monthly subscription that adds a cosmetic 🍺 badge to your profile. It unlocks no tracking functionality — every core feature is free. Subscriptions auto-renew unless cancelled; manage or cancel any time in your App Store account settings.

Kiroku is intended for adults (18+) who want to monitor and reflect on their own drinking. It does not provide medical advice. If you are concerned about your drinking, please consult a healthcare professional.
```

**Support URL**
```
https://www.kiroku.cz
```
*(If a dedicated support/contact page exists — e.g. `https://www.kiroku.cz/support` — prefer that. Verify the page resolves before submitting; ASC validates the URL.)*

**Marketing URL** (optional)
```
https://www.kiroku.cz
```

**Copyright**
```
2026 Kiroku
```

---

### 1b. Czech (cs) — app ships `cs_cz` (`src/languages/cs_cz.ts`)

Tone matched to the app's own in-app Czech copy (`cs_cz.ts:641`, `:1185-1186`).

**App Name** (max 30)
```
Kiroku: Sledování alkoholu
```
*(26 chars)*

**Subtitle** (max 30)
```
Mějte přehled o pití
```
*(20 chars)*

**Promotional text** (max 170)
```
Zaznamenávejte každý nápoj, sledujte své vzorce a získejte přehled o svých návycích. Soukromé, funguje offline a bez předsudků. Převezměte kontrolu nad svými daty.
```
*(~161 chars — verify in ASC's counter, accented chars count as 1 each)*

**Keywords** (max 100)
```
alkohol,pití,sledování,střízlivost,návyk,zdraví,jednotky,deník,záznam,kalendář,statistiky,přehled
```
*(verify char count in ASC)*

**Description**
```
Kiroku vám pomáhá sledovat a pochopit vaši konzumaci alkoholu — abyste se mohli informovaně rozhodovat o svých vlastních návycích.

Je to nástroj pro osobní sledování a sebereflexi, ne společník k pití. Kiroku je postavené na principu snižování rizik: čím jasněji vidíte své vlastní vzorce, tím snáze si stanovíte cíle, všimnete si trendů a omezíte pití, když budete chtít.

CO MŮŽETE DĚLAT
• Zaznamenávat alkoholové relace v reálném čase nebo je doplnit později
• Evidovat druhy nápojů a standardizované jednotky pro každou relaci
• Přidávat poznámky k zapamatování kontextu relace
• Procházet celou historii v měsíčním kalendáři
• Sledovat statistiky a trendy: součty, jednotky v čase, dny bez alkoholu, vzorce a rozbory
• Sledovat dny bez alkoholu a oslavit dny, kdy jste nepili

SOUKROMÍ NA PRVNÍM MÍSTĚ
• Funguje offline a synchronizuje se po obnovení připojení
• Vaše data patří vám — kdykoli je můžete zobrazit, upravit či smazat
• Účet i data můžete kdykoli smazat přímo v aplikaci

ZŮSTAŇTE VE SPOJENÍ (VOLITELNÉ)
• Přidejte si přátele a podporujte se navzájem
• Zobrazte si odznak podporovatele u přátel

KIROKU SUPPORTER (VOLITELNÉ PŘEDPLATNÉ)
Kiroku je zdarma. Pokud chcete podpořit vývoj, „Kiroku Supporter" je volitelné měsíční předplatné, které přidá kosmetický odznak 🍺 k vašemu profilu. Neodemyká žádné funkce sledování — vše podstatné je zdarma. Předplatné se automaticky obnovuje, dokud jej nezrušíte; spravovat či zrušit jej můžete kdykoli v nastavení účtu App Store.

Kiroku je určeno pro dospělé (18+), kteří chtějí sledovat a reflektovat své vlastní pití. Neposkytuje lékařské rady. Máte-li obavy o své pití, obraťte se prosím na odborníka.
```

> **Note on localization in ASC:** the primary language for this account is likely English. Add Czech as an additional App Store localization under the version, then paste the cs copy there. If you only want one storefront language at launch, English alone is acceptable — Czech can be added later without re-review of the binary.

---

## 2. App Privacy questionnaire mapping (the "nutrition label")

This is the most consequential deliverable. Below is an accurate mapping derived from the actual codebase, with file:line evidence. Declare these in **ASC → App Privacy**.

> The ASC flow asks, per data type: **(a)** Is it collected? **(b)** Is it linked to the user's identity? **(c)** Is it used to track the user across apps/companies? **(d)** What are the purposes? Kiroku does **no cross-app tracking** and runs **no third-party ad SDKs** — so for every type below, answer **"Tracking: No"**.

### Data types to declare as COLLECTED

| ASC data type | Linked to identity? | Tracking? | Purpose | Evidence |
|---|---|---|---|---|
| **Email Address** (Contact Info) | Yes | No | App Functionality (account auth) | `src/libs/actions/User.ts` email/password + OAuth sign-in (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`) |
| **Name** (Contact Info) | Yes | No | App Functionality | Profile `first_name`, `last_name`, `display_name` — `src/types/onyx/UserData.ts:18-39`, `src/DBPATHS.ts` (`USERS_USER_ID_PROFILE_*`) |
| **Photos** (User Content) | Yes | No | App Functionality (profile picture) | `src/components/UploadImage.tsx`, `src/storage/storageUpload.ts` (`uploadBytesResumable` to Firebase Storage), `src/libs/actions/Profile.ts` |
| **User ID** (Identifiers) | Yes | No | App Functionality | Firebase UID, keys all DB records |
| **Device ID** (Identifiers) | Yes | No | App Functionality (push notif targeting) | `src/libs/actions/Device/index.ts`, `generateDeviceID/index.ios.ts` (`DeviceInfo.getUniqueId()`); sent with push opt-in `src/libs/actions/PushNotification.ts` |
| **Purchase History** (Purchases) | Yes | No | App Functionality (subscription) | RevenueCat: `src/libs/actions/Subscriptions.ts` (`Purchases.logIn(userId)`, entitlement/tier/expiry); `CONFIG.REVENUECAT` |
| **Health & Fitness** ⚠️ — *Sensitive Info / Other Data* | Yes | No | App Functionality | Drinking session data: timestamps, drink counts, units, notes, blackout flag — `src/types/onyx/DrinkingSession.ts`, `src/DBPATHS.ts` (`USER_DRINKING_SESSIONS_*`), `src/libs/actions/DrinkingSession.ts` |
| **Other User Content** (notes, friends) | Yes | No | App Functionality | Session notes; social graph: friends, friend requests, nicknames — `src/DBPATHS.ts` (`USERS_USER_ID_FRIENDS`, `NICKNAME_TO_ID`), `src/types/onyx/FriendRequestList.ts` |
| **Product Interaction / Other Usage Data** | Yes | No | App Functionality | Preferences (theme, locale, units, first day of week), onboarding progress, last-online status — `src/DBPATHS.ts` (`USER_PREFERENCES_*`, `USER_STATUS_*`) |

### Crash Data — DECLARE (decision 2026-05-28: Petr will ship crash reporting on)

| ASC data type | Linked? | Tracking? | Purpose | Evidence |
|---|---|---|---|---|
| **Crash Data** (Diagnostics) | Yes | No | App Functionality (stability) | Firebase Crashlytics — `src/setup/platformSetup/index.native.ts`, `src/libs/setCrashlyticsUserId/index.native.ts` (`setUserId`) |

> **Declared.** Crashlytics is gated behind `CONFIG.SEND_CRASH_REPORTS` (`src/CONFIG.ts:123`). Ship the **production build with `SEND_CRASH_REPORTS=true`** so the declaration matches reality. Crashes are linked to the account via `setUserId`.
>
> **Consent (GDPR — binding for a Czech company / EU users):** no Apple ATT prompt is needed (this is not cross-app *tracking*). But crash data tied to an account ID is personal data and needs a lawful basis:
> - **Required:** kiroku.cz/privacy must disclose crash collection, name the processor (Google / Firebase Crashlytics), and state the lawful basis (legitimate interest is the standard route for diagnostics).
> - **Recommended (code task — tracked in #651):** add a user-facing **opt-out toggle** in a new Settings → Privacy section so EU users can decline. The existing `SEND_CRASH_REPORTS` is a build flag, not user-facing. Not a hard launch blocker — until #651 lands, rely on legitimate-interest + policy disclosure + opt-out-on-request.

### NOT collected — do not declare (verified dormant/absent in code)

- **Location** — `USER_LOCATION` Onyx key exists (`src/ONYXKEYS.ts`) but nothing reads/writes/sends it; no geolocation API, no location permission. **Do not declare.**
- **Firebase Analytics** — `measurementId` present in `CONFIG.FIREBASE_CONFIG` but no `logEvent` calls anywhere. Not active → do not declare as Analytics usage. *(If you intend to enable it later, revisit the label.)*
- **Pusher** — `pusher-js` present but all Pusher code is commented out (`src/libs/Pusher/pusher.ts`, `PusherUtils.ts`). No data currently flows. **Do not declare.**

### ⚠️ Findings that may surprise Petr / cross-check vs. live privacy policy (kiroku.cz/privacy)

1. **Drinking session data is health-adjacent.** Apple's privacy taxonomy has no exact "alcohol intake" bucket; map it to **Health & Fitness → Other Data** (or "Sensitive Info" if the flow offers it). Make sure kiroku.cz/privacy describes this consumption data explicitly as personal/health-related data you store. This is also the field most relevant to the 1.4.3 concept review.
2. **Device ID persists across sign-out** (`generateDeviceID` stores a GUID locally, reused across accounts). It's a device-global identifier sent with push opt-in/out. Confirm the privacy policy mentions device identifiers.
3. **Profile photos go to Firebase Storage.** Verify the storage bucket's read ACLs — if photo URLs are world-readable, the policy should reflect that photos may be visible to others (friends view them).
4. **RevenueCat is a third-party processor** that receives the Firebase UID (`Purchases.logIn(userId)`). The subscription-terms page already names RevenueCat (confirmed in #648) — good. Make sure the *privacy* policy also lists RevenueCat as a sub-processor.
5. **Crashlytics linkage** — if enabled in prod, crashes are linked to the account ID. Policy should mention crash diagnostics + the third party (Google/Firebase Crashlytics).

**Action:** before submitting, read kiroku.cz/privacy and confirm it covers: health/consumption data, device identifiers, profile photos, RevenueCat, and (if enabled) Crashlytics. Any of these present in code but absent from the policy is an inconsistency Apple can flag.

---

## 3. Age rating questionnaire

**Recommended result: 17+ (Apple's "Frequent/Intense" alcohol references tier).**

Rationale: the entire app revolves around logging alcohol consumption. Even though the framing is harm-reduction, the *content* references alcohol pervasively (drink logging, calendar of drinking sessions, stats). Under-rating risks a metadata rejection. The Terms already state 18+ eligibility, so 17+ is consistent (and the strictest Apple offers short of the dedicated alcohol/tobacco/drug gate).

ASC age-rating questionnaire answers (new ASC questionnaire, 2024+ format — wording may vary slightly):

| Question | Answer | Why |
|---|---|---|
| Alcohol, Tobacco, or Drug Use or References | **Frequent/Intense** | The app's core purpose is logging alcohol intake — references are pervasive, not incidental. Choosing "Infrequent/Mild" risks an under-rating rejection. |
| Medical/Treatment Information | **None** | Kiroku does not provide medical advice or treatment info (the description explicitly disclaims this). |
| Sexual Content / Nudity | **None** | — |
| Violence (cartoon/realistic) | **None** | — |
| Profanity or Crude Humor | **None** | — |
| Horror/Fear, Mature/Suggestive Themes | **None** | — |
| Gambling, Contests | **None** | No gambling/simulated gambling. |
| Unrestricted Web Access | **No** | WebViews only load fixed kiroku.cz legal pages. |
| Made for Kids | **No** | — |

> If the questionnaire surfaces a **"Does your app encourage consumption of alcohol/tobacco/drugs?"** style yes/no — answer **No**, and lean on the App Review notes (§4) to explain the harm-reduction purpose.

Expected computed rating: **17+**. Confirm it matches the 18+ Terms; if Apple's max is 17+, that's the correct ceiling for this app.

---

## 4. App Review notes (paste into "Notes" field)

```
WHAT KIROKU IS
Kiroku is a personal alcohol-tracking and self-awareness tool. Users log their own drinking sessions to understand their consumption patterns over time. The purpose is harm reduction and reflection — the app does NOT encourage, reward, or gamify drinking. It is intended for adults (18+); the Terms of Service state 18+ eligibility.

HOW TO REVIEW
1. Sign in with the demo account below (email/password). Sign in with Apple and Google Sign In are also supported.
2. Home screen: tap to start a drinking session, log drinks, add a note, and end the session.
3. Calendar: browse past sessions by month (the demo account is pre-seeded with sample sessions).
4. Statistics: four tabs (Overview, Trends, Patterns, Breakdown) visualize totals, units over time, and alcohol-free days.
5. Profile / Friends: the demo account has one friend so you can see the social/badge surface.
6. Account deletion is available in Settings > Delete Account (Guideline 5.1.1(v)).

SUBSCRIPTION (Kiroku Supporter)
"Kiroku Supporter" (product: supporter_monthly) is an OPTIONAL, purely cosmetic subscription that adds a 🍺 badge to the user's profile. It unlocks NO functionality — every tracking feature is free. The paywall is reachable from Settings > "Support Kiroku 🍺". Auto-renewal, cancellation, and refund terms are on the paywall's legal footer and at https://www.kiroku.cz/subscription-terms. Restore Purchases is available on the same screen.

PRIVACY
Privacy Policy: https://www.kiroku.cz/privacy
Terms: https://www.kiroku.cz/terms
Subscription Terms: https://www.kiroku.cz/subscription-terms
Data is offline-first and account-scoped; users can delete all data in-app.

DEMO ACCOUNT
Email:    <FILL IN — see §5>
Password: <FILL IN — see §5>
```

---

## 5. Demo (reviewer) account setup — for Petr

Claude cannot create this (no Firebase credentials). Create it manually so the reviewer sees a populated, social app. Do this against the **production** Firebase project (the one the App Store build points at) so the reviewer's sign-in actually works.

**Steps:**

1. **Create the reviewer account.**
   - Easiest: install the production/TestFlight build, sign up with email/password using a dedicated address, e.g. `appreview@kiroku.cz` (or a `+review` alias you control). Use a strong but simple password you can paste into ASC.
   - Complete onboarding so the account isn't stuck on a first-run screen. Set a display name like "App Reviewer".

2. **Seed sample drinking sessions** (so Calendar + Statistics aren't empty). Add ~8–12 sessions spread across the last 2 months, varied so the stats tabs render meaningfully:
   - A few recent sessions (this week) and several older ones across the prior month.
   - Vary drink counts/units per session (e.g. 1–6 units).
   - Add a **note** to at least one session (demonstrates the notes feature).
   - Mark a couple of days as alcohol-free / leave gaps so "alcohol-free days" stats show non-zero.
   - Optionally set the `blackout` flag on one to exercise that field.
   - You can do this entirely through the app UI (start session → log drinks → end), which is the most faithful path and avoids hand-writing RTDB JSON.

3. **Add one friend** (to show the social + supporter-badge surface):
   - Create a second throwaway account (e.g. `appreview-friend@kiroku.cz`), give it a display name and a couple of sessions, then send/accept a friend request between the two accounts.
   - Optional but nice: make the *friend* account a supporter (or set its public `is_supporter` flag) so the reviewer sees the 🍺 badge on a friend's profile.

4. **Verify before submitting:** sign out, sign back in as the reviewer account on a clean device/simulator, and confirm: Calendar shows sessions, Statistics tabs render data, the friend appears, and the "Support Kiroku 🍺" paywall loads (requires the visibility flag flipped — see §7).

5. **Paste the final credentials** into the §4 review notes and into ASC's "Sign-In Information" fields (check "Sign-in required").

> Keep this account active and seeded for the lifetime of the listing — re-reviews of future versions will reuse it.

---

## 6. Screenshot plan

Apple's current requirement (2024+): you **must** provide **6.9"/6.7" iPhone** screenshots; a **5.5"** set is no longer required but iPad screenshots are required **only if** the app supports iPad. Provide the 6.7"/6.9" set at minimum; add iPad if Kiroku ships an iPad-capable build.

| Display class | Required? | Resolution (portrait) | Simulator device that satisfies it |
|---|---|---|---|
| 6.7"/6.9" iPhone | **Mandatory** | 1290 × 2796 (6.7") or 1320 × 2868 (6.9") | iPhone 16 Pro Max / iPhone 15 Pro Max |
| 6.5" iPhone | Optional (often reused from 6.7") | 1284 × 2778 | iPhone 14 Plus / 11 Pro Max |
| 13" iPad | Only if iPad-supported | 2064 × 2752 | iPad Pro 13" (M4) |

> You can usually upload one high-res 6.7"/6.9" set and let ASC scale; but capturing natively avoids letterboxing.

**Screens to capture (6–8 shots, in this order):**

1. **Home / session start** — the main tracking entry point. Caption: *"Track every drinking session"*
2. **Active session / drink logging** — logging drinks + units. Caption: *"Log drinks and units in seconds"*
3. **Calendar** — month view with sessions marked. Caption: *"See your full history at a glance"*
4. **Statistics — Overview or Trends tab** — charts. Caption: *"Understand your patterns over time"*
5. **Statistics — alcohol-free days / Breakdown** — Caption: *"Celebrate your alcohol-free days"*
6. **Profile** (with friend / badge visible) — Caption: *"Share progress with friends"*
7. **Support Kiroku paywall** — Caption: *"Support Kiroku — optional 🍺 badge"* (requires visibility flag on, §7)
8. *(optional)* **Session note / detail** — Caption: *"Add notes to remember the context"*

**Capture tips:**
- Use the seeded reviewer account (or a screenshot account with nicer demo data) so charts/calendar aren't empty.
- Keep captions consistent with the harm-reduction framing — avoid anything celebratory about drinking *volume*.
- Localize captions for the Czech storefront if you publish cs screenshots (otherwise English screenshots are shown for cs too — acceptable).
- Capture in light mode for clarity, or provide a mix; be consistent.

---

## 7. ASC submission walkthrough (click-by-click for Petr)

> Prereqs done first: app record exists in ASC, the build is uploaded via Xcode/Transporter and finished processing, and **`supporter_monthly` is created as an Auto-Renewable Subscription** in ASC (Features → Subscriptions → a Subscription Group) in "Ready to Submit" state with localized display name "Kiroku Supporter", price, and a review screenshot of the paywall.

**A. Prep both subscriptions — monthly + annual (decision 2026-05-28: annual ships at launch)**
1. In **Features → Subscriptions**, create/confirm BOTH products in the same Subscription Group:
   - **`supporter_monthly`** — priced, localized ("Kiroku Supporter"), review screenshot attached.
   - **`supporter_annual`** — same display name, annual price, review screenshot. Put it in the **same group** as monthly so they're mutually-exclusive upgrade/crossgrade tiers.
2. **⚠️ Annual requires app code — not just ASC.** The paywall today only reads the monthly package: `SupportKirokuScreen.tsx:60` (`const pkg = offering?.monthly ?? null`), the CTA is hardcoded "/ month" (`:260`, `supporter.paywallScreen.purchaseCta`), and `ManageSubscriptionScreen.tsx:24` hardcodes the monthly SKU. To actually sell annual you must: surface both packages from the RevenueCat offering, let the user choose monthly vs annual, make the CTA/price dynamic, and update `ManageSubscriptionScreen` to handle either SKU. **This is owned by the supporter/code session, not this kit.** Do not attach `supporter_annual` to the version until the build can sell it — an attached-but-unsellable product triggers metadata-mismatch rejection.

**B. Supporter visibility flag — must be ON in the submitted build**
1. `SupporterUtils.isSupporterTierVisible()` returns `!CONFIG.IS_IN_PRODUCTION` (`src/libs/SupporterUtils.ts:17-19`), so a production build **hides** the paywall. The reviewer tests the exact build you submit — if the paywall is hidden, they can't test the IAP and the first-subscription submission gets rejected (Guideline 2.1). **The flag must be ON in the submitted production build.**
2. **Decision 2026-05-28: supporter ships at launch**, so the original "hide until v1.1" rationale in `SupporterUtils` is **obsolete** — make the paywall permanently visible in production (the code session should simplify/remove the gate). The manual-release hold (step H) is now *optional* — only use it if you want to stagger the public launch date from the approval date.
3. **This is a code change in the supporter/code session** (Claude is not editing app code in this kit). **Verify on the actual TestFlight/production build that "Support Kiroku 🍺" appears in Settings and the paywall loads — showing both monthly and annual — before submitting.**

**C. Create the version & fill metadata**
1. ASC → **Apps → Kiroku → (left sidebar) iOS App → "+ Version or Platform"** (or the existing "1.0 Prepare for Submission"). Set version string (e.g. `1.0`).
2. **Promotional Text / Description / Keywords / Support URL / Marketing URL** — paste from §1 (English). Add Czech localization (top-left language dropdown → Add Czech) and paste §1b if publishing cs.
3. **Screenshots** — upload the 6.7"/6.9" set (and iPad if applicable) from §6 into each required size slot.
4. **App Icon / Build** — under "Build", click **"+"** and select the processed build.
5. **General App Information** — set primary category (suggest **Health & Fitness**, secondary optional e.g. Lifestyle), age rating (next step), and copyright.

**D. Attach the subscription to this version**
1. In the version page, find the **"In-App Purchases and Subscriptions"** section → **"+"** → select **`supporter_monthly`**. (Attaching it to a *version* submission is what clears Apple's first-subscription gate — issue #648 / #645.)
2. Confirm only the products you actually sell are attached (monthly only, unless you deliberately ship annual).

**E. Age rating**
1. Version page → **Age Rating → "Edit"** → answer the questionnaire per §3 (Alcohol references = **Frequent/Intense**, everything else **None**, no encouragement of consumption). Save. Confirm computed **17+**.

**F. App Privacy (nutrition label)**
1. Left sidebar → **App Privacy → "Get Started"/"Edit"**.
2. Add each data type from §2 (Email, Name, Photos, User ID, Device ID, Purchase History, Health/consumption data, Other User Content, Usage Data; **Crash Data only if `SEND_CRASH_REPORTS=true` in the prod build**).
3. For every type: **Linked to user = Yes**, **Used for tracking = No**, **Purpose = App Functionality** (Health/stability where applicable). Do **not** add Location, Analytics, or Pusher.
4. Set the **Privacy Policy URL** = `https://www.kiroku.cz/privacy` (under App Privacy / App Information).
5. Publish the privacy responses.

**G. App Review Information**
1. Version page → **App Review Information**: check **"Sign-in required"**, paste the demo account email/password (§5).
2. **Notes** — paste the §4 review notes (with credentials filled in).
3. Contact info: your name, phone, email.

**H. Release control — hold as Pending Developer Release**
1. Version page → **"Version Release"** section → select **"Manually release this version"** (NOT automatic). This makes the approved build sit as **Pending Developer Release** so approval ≠ public launch (you launch when ready, decoupled from the supporter v1.1 timing).

**I. Submit**
1. Click **"Add for Review"** / **"Submit for Review"** (top right).
2. Answer the export-compliance prompt (Kiroku uses standard HTTPS/TLS only → typically **"Yes" uses encryption** → **exempt** under standard encryption; confirm against your build's `ITSAppUsesNonExemptEncryption` setting).
3. Submit. Monitor status in ASC and via email.

---

## 8. Decisions & status (updated 2026-05-28)

**Resolved:**
- ✅ **Crash Data** — DECLARE it; ship prod with `SEND_CRASH_REPORTS=true`. (§2)
- ✅ **`supporter_annual`** — ships at launch (both monthly + annual). (§7A)
- ✅ **Reviewer demo account** — Petr reports it's ready. Re-verify it's seeded with sessions + a friend before submitting (§5).
- ✅ **Screenshots** — owned by a separate session (§6).
- ✅ **Privacy/Terms review** — spun up as a separate session against the `kiroku-web` repo.

**Still open / depends on the code session:**
1. **Annual paywall code** — the app can only sell monthly today; selling annual needs UI + SKU work in the supporter/code session. Don't attach `supporter_annual` in ASC until the build sells it. (§7A)
2. **Supporter visibility flag** — must be ON in the submitted build; the v1.1-hide rationale is now obsolete (supporter ships at launch). Code session removes/flips the gate; verify on the real build. (§7B)
3. **Crash-reporting opt-out toggle** — tracked in **#651** (new Settings → Privacy section). Not a launch blocker; until it lands, kiroku.cz/privacy must disclose Crashlytics + lawful basis. (§2)
4. **Storefront languages at launch** — English only, or English + Czech? (Czech can be added later without re-review.) (§1)
5. **Support URL** — bare `kiroku.cz` or a dedicated `/support` page? Ensure it resolves.
6. **App category** — recommend **Health & Fitness** primary; confirm the positioning. (§7C)
```

---

## 9. RevenueCat + ASC subscription config verification (do this FIRST)

Front-load this. The paywall code depends on the dashboard being correct (`SupportKirokuScreen.tsx:59-65` reads `offerings.current` and `offering?.monthly` / `offering.annual`). If any item below is wrong, the paywall silently renders its **"unavailable"** state and there's nothing for a reviewer (or user) to buy. Verify each, then the annual UI work is safe to write and sandbox-test.

> Identifiers the code expects (must match exactly): entitlement **`supporter`** (`Subscriptions.ts:18`); product IDs **`supporter_monthly`** + **`supporter_annual`**; API keys in env as **`REVENUECAT_IOS_API_KEY`** / **`REVENUECAT_ANDROID_API_KEY`** (`CONFIG.ts:120-121`).

### A. App Store Connect (iOS)
- [ ] **Agreements, Tax, and Banking → Paid Apps agreement is ACTIVE.** *(Classic gotcha: no IAP works at all until this is signed and active, including bank + tax forms.)*
- [ ] A **Subscription Group** exists; both `supporter_monthly` and `supporter_annual` live in **the same group** (makes them mutually-exclusive upgrade/crossgrade tiers).
- [ ] Each product: **price set** (all territories you sell in), **localized display name + description** (en, and cs if publishing Czech), and a **review screenshot** of the paywall attached.
- [ ] Each product status is **"Ready to Submit"** / approved-pending (not "Missing Metadata").
- [ ] The **In-App Purchase Key (.p8)** OR **App-Specific Shared Secret** is generated in ASC and pasted into RevenueCat (see B) — RevenueCat needs it to validate iOS receipts. *(Without it, purchases/restores fail validation.)*

### B. RevenueCat dashboard
- [ ] **iOS app** configured with the App Bundle ID and the ASC In-App Purchase Key / Shared Secret from A.
- [ ] **Android app** configured with the Play package + Play **service-account credentials JSON** (and the products exist in Play Console). *(Only needed if Android ships with the supporter feature at the same time.)*
- [ ] **Entitlement** named exactly **`supporter`** exists.
- [ ] **Products** `supporter_monthly` and `supporter_annual` imported from the stores and **both attached to the `supporter` entitlement**.
- [ ] A **Current Offering** is published whose packages are typed **Monthly** and **Annual** (RevenueCat standard duration types). ⚠️ **This is the make-or-break item** — `offering.monthly` / `offering.annual` only resolve for those standard package types; a custom package identifier returns `undefined` and the paywall goes "unavailable".
- [ ] **API keys populated in the production build's env** (`REVENUECAT_IOS_API_KEY` / `REVENUECAT_ANDROID_API_KEY`). If absent, `Subscriptions.initialize()` no-ops and the SDK never configures (`Subscriptions.ts:100-104`).

### C. Smoke test (confirms A+B are actually wired)
- [ ] On a **dev/staging build** (where the paywall is already visible), open Support Kiroku → the paywall loads with a real price (not "unavailable"). This proves `getOfferings()` returns the current offering with a resolvable package.
- [ ] **Sandbox purchase** the monthly package with a StoreKit sandbox tester → the 🍺 badge appears and `is_supporter` flips. *(Annual can't be smoke-tested until the annual UI lands, but if monthly works, the wiring is sound and annual is just another package in the same offering.)*

> Once A+B+C are ticked, the dashboard side is **done** — the remaining work is purely the in-app annual UI + visibility flag (the supporter/code session), and that can be tested against this verified config.
