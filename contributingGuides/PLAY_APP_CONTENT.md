# Play Console App content: the record

Google Play's App content declarations (Data safety, content rating, target
audience, and the rest) live only in Play Console. The Android Publisher API
that `scripts/play.mjs` uses cannot read any of them, and the only one it can
write is Data safety, as a CSV upload. So an app that loses them has to answer
them again from memory. This file is that memory, the Play counterpart of
[`APP_PRIVACY_LABELS.md`](./APP_PRIVACY_LABELS.md).

It records what `com.alcohol_tracker` declares after the review on 10 September
2026, done before Android 1.0 went to production. `node scripts/play.mjs status`
ends with the same list of console-only items.

## Account state

| Item               | State on 10 September 2026                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Production access  | Granted. Test and release > Production offers **Create new release**, with no closed-test gate. |
| Managed publishing | **On.** Nothing reaches users until someone presses **Publish changes** in Publishing overview. |

## App content declarations

Play Console > Monitor and improve > Policy and programs > App content. Ten
declarations are filed, under the **Actioned** tab.

| Declaration               | Answer                                                                                                                                                                                                               | 10 September 2026                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Privacy policy            | `https://www.kiroku.cz/privacy`                                                                                                                                                                                      | Checked, unchanged                                                  |
| Ads                       | The app contains no ads                                                                                                                                                                                              | Checked, unchanged                                                  |
| Advertising ID            | Not used: no ad, attribution or analytics SDK ships                                                                                                                                                                  | Checked, unchanged                                                  |
| Target audience           | 18 and over only                                                                                                                                                                                                     | Checked, unchanged                                                  |
| Government apps           | No                                                                                                                                                                                                                   | Checked, unchanged                                                  |
| Financial features        | None                                                                                                                                                                                                                 | Checked, unchanged                                                  |
| Health apps               | Only "Other" ticked (1 of 18 boxes), described as: "Tracks alcohol consumption for personal use and provides insights into drinking habits. Does not provide medical advice or claim to diagnose health conditions." | Checked, unchanged                                                  |
| App access (sign-in info) | The reviewer demo account, the same credentials as the `APPLE_DEMO_EMAIL` / `APPLE_DEMO_PASSWORD` GitHub secrets                                                                                                     | Checked, matches                                                    |
| Content rating            | IARC questionnaire answered again on 10 September 2026 (PEGI 3, ESRB Teen); see below                                                                                                                                | Redone, saved, waiting in Publishing overview to be sent for review |
| Data safety               | See [Data safety](#data-safety)                                                                                                                                                                                      | Redone                                                              |

### Content rating

Answered again on 10 September 2026. This replaces the IARC questionnaire of
9 October 2023, which came before friends and the tip jar existed and said that
promoting alcohol was a focus of the app. The new answers are saved and wait in
Publishing overview until they're sent for review. Category: **All Other App
Types**.

The answers, section by section. Any question not listed was answered No.

| Section                                                    | Answers                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Downloaded app                                             | Ratings-relevant content in the app package: Yes                                                                                                                                                                                                                                                 |
| Violence, fear, sexuality, gambling, language, crude humor | No                                                                                                                                                                                                                                                                                               |
| Controlled substance                                       | Alcohol only. Reference: ticked; Use and Encourages/Glamorizes: not ticked. Frequency: Often                                                                                                                                                                                                     |
| User content sharing                                       | Users interact or exchange content: Yes (names, photos and sessions reach friends). User content is the primary source of content: No. Public sharing of nudity or graphic violence: No. Block: Yes. Report: Yes. Chat moderation: No (there is no chat). Can be limited to invited friends: Yes |
| Online content                                             | No                                                                                                                                                                                                                                                                                               |
| Promotion or sale of age-restricted products               | No                                                                                                                                                                                                                                                                                               |
| Miscellaneous                                              | Shares precise location with other users: No. Digital purchases: Yes (the tips), with no chance-based items. Cash rewards, gift cards, crypto or NFTs: No. Web browser or search engine: No. Primarily news or educational: No                                                                   |

The ratings, from Play's summary screen before saving:

| Authority                    | Before (2023) | After (10 September 2026) |
| ---------------------------- | ------------- | ------------------------- |
| ClassInd (Brazil)            | 12+           | 14+ (Legal Drugs)         |
| ESRB (North America)         | Mature 17+    | Teen (Alcohol Reference)  |
| PEGI (Europe)                | PEGI 18       | PEGI 3                    |
| USK (Germany)                | 18+           | All ages                  |
| IARC Generic (rest of world) | 18+           | 3+                        |

Every region also lists "Users Interact" and "In-App Purchases". Google Play's
own ratings for Russia and South Korea are 3+. IARC's rating authorities can
still revise them after review.

Why they dropped: the 2023 answers said that promoting or selling age-restricted
goods, alcohol specifically, was a focus of the app. Kiroku doesn't sell,
deliver, advertise or promote alcohol (the App Review notes in
`fastlane/Fastfile` say the same), so both answers are now No. The content
rating is separate from the 18+ target audience, which is unchanged.

Two answers that rest on the code:

- **Shares location with other users: No.** Drink locations are never shown to
  friends. `user_session_locations` is readable only by admins in the database
  rules, and location tagging is off by default.
- **User content is the primary source of content: No.** The main content is
  the user's own diary. Friends see display names, profile photos and sessions;
  session notes are private.

## Data safety

Policy and programs > App content > Actioned > Data safety > **Manage**. The
editor has five steps. It saves each change as a pending "Complete Data safety
questionnaire" item in Publishing overview, not as a draft.

### Step 2: Data collection and security

| Question                                           | Answer                                    |
| -------------------------------------------------- | ----------------------------------------- |
| Collects or shares any of the required data types? | Yes                                       |
| All user data encrypted in transit?                | Yes                                       |
| Account creation methods                           | **Username and password** and **OAuth**   |
| Delete account URL                                 | `https://www.kiroku.cz/en/delete-account` |
| Can users delete some data without their account?  | Yes                                       |
| Delete data URL                                    | `https://www.kiroku.cz/en/delete-account` |

OAuth covers Sign in with Google and Sign in with Apple. Both URLs used to point
at `github.com/PetrCala/Kiroku`. The delete-account page loads, names Kiroku
and its developer, gives the in-app steps and an email fallback (which also
covers partial deletion requests), and lists what is deleted and what is kept.

### Step 3: Data types

Thirteen types, and nothing else ticked. Messages, Audio, Files and docs,
Calendar, Contacts and Web browsing stay empty.

| Category                 | Data types                                     |
| ------------------------ | ---------------------------------------------- |
| Location                 | Approximate location, Precise location         |
| Personal info            | Name, Email address, User IDs                  |
| Financial info           | Purchase history                               |
| Health and fitness       | Health info                                    |
| Photos and videos        | Photos                                         |
| App activity             | App interactions, Other user-generated content |
| App info and performance | Crash logs, Diagnostics                        |
| Device or other IDs      | Device or other IDs                            |

Why the less obvious ones are there:

- **Both location types:** the Android manifest requests fine and coarse
  location. Tagging drinks with a location is opt-in and off by default.
- **Purchase history:** the tip jar, through Google Play Billing and RevenueCat.
- **Device or other IDs:** the device ID sent when push notifications are turned
  on or off.

### Step 4: Data usage and handling

The same three answers for every type: **Collected** only (nothing is shared),
**not** processed ephemerally, and required or optional as below. No type
claims Developer communications, Advertising or marketing, or Fraud
prevention, security, and compliance.

| Data type                    | Required or optional | Purposes                                                          |
| ---------------------------- | -------------------- | ----------------------------------------------------------------- |
| Approximate location         | Users can choose     | App functionality                                                 |
| Precise location             | Users can choose     | App functionality                                                 |
| Name                         | Required             | App functionality, Analytics, Personalization, Account management |
| Email address                | Required             | App functionality, Analytics, Personalization, Account management |
| User IDs                     | Required             | App functionality, Account management                             |
| Purchase history             | Users can choose     | App functionality                                                 |
| Health info                  | Required             | App functionality                                                 |
| Photos                       | Users can choose     | App functionality                                                 |
| App interactions             | Required             | App functionality                                                 |
| Other user-generated content | Users can choose     | App functionality, Analytics, Personalization                     |
| Crash logs                   | Users can choose     | App functionality, Analytics                                      |
| Diagnostics                  | Users can choose     | App functionality, Analytics, Personalization                     |
| Device or other IDs          | Required             | App functionality                                                 |

Crash logs and Diagnostics are optional because users can turn Crashlytics and
Performance Monitoring off in Settings > Privacy.

### Step 5: Preview

The summary reads: 13 data types collected, no data shared, data encrypted in
transit.

### How it maps to the iOS label

The purposes follow the App Store label in
[`APP_PRIVACY_LABELS.md`](./APP_PRIVACY_LABELS.md) type for type, including the
Analytics and Personalization claims that file flags as over-declared. Play
adds Account management, which has no App Store equivalent. The two lists
differ in one type each way:

- **Approximate location** is declared on Play only, because the Android
  manifest requests coarse location as well as fine.
- **Other Data Types** is declared on the App Store only. Play has no catch-all
  type, and drinking sessions are covered by Health info on both stores.

Otherwise Play's App interactions is the App Store's Product Interaction,
Diagnostics is Performance Data, and Crash logs is Crash Data.

## Store settings

Grow users > Store presence > Store settings.

| Setting       | Value                                                                              |
| ------------- | ---------------------------------------------------------------------------------- |
| App or game   | App                                                                                |
| Category      | Health & Fitness                                                                   |
| Contact email | `kiroku.alcohol.tracker@gmail.com`                                                 |
| Website       | `https://www.kiroku.cz` (was `github.com/PetrCala/Kiroku` until 10 September 2026) |

In-app products: the three `kiroku.tipjar.*` tips are active one-time products,
created by `node scripts/play.mjs tips` (see [`TIP_JAR.md`](./TIP_JAR.md)). The
`supporter_monthly` subscription is active on Play but stays hidden in the app.

## Loose ends (not Play blockers)

- The privacy policy doesn't mention Cloud Vision SafeSearch (used to screen
  profile photos), and doesn't clearly name Crashlytics. It does name
  Performance Monitoring.
- The delete-account page says "Settings → your account settings", while the
  app's path is Settings > Privacy > Manage account > Delete account.
