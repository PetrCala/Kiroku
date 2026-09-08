# App Privacy labels: the transcript

App Store Connect's App Privacy questionnaire (the "nutrition label") is the one
part of the store record that **no API can read or write**. Both candidate
endpoints 404, re-verified 8 September 2026 against a live token:

```
GET /v1/appDataUsages                  -> 404 PATH_ERROR  "The resource 'v1/appDataUsages' does not exist"
GET /v1/apps/<id>/appDataUsages        -> 404 PATH_ERROR  "The relationship 'appDataUsages' does not exist"
GET /v1/apps/<id>/appPrivacyDetails    -> 404 PATH_ERROR  "The relationship 'appPrivacyDetails' does not exist"
```

So `scripts/asc.mjs clone-listing` cannot carry it across, the answers exist only
inside the web UI, and a record that loses them has to be re-answered from
memory. This file is that memory.

It is a **transcript of what record `6466886157` ("Kiroku Legacy") actually
answered**, read off its App Privacy page on 8 September 2026, published 3 months
earlier by Petr Cala. It is deliberately not a proposal and not a correction. The
job it exists for is rebuilding the same label on record `6670502234` ("Kiroku"),
where the questionnaire is still at "Get Started", and matching the old record
question for question is the point. See "Where this disagrees with the code"
below for the parts worth revisiting **as a separate decision, later**.

## Privacy Policy

Entered under App Privacy > Privacy Policy, per locale. Only `English (U.S.)`
carries a value.

| Field                    | Value                           |
| ------------------------ | ------------------------------- |
| Privacy Policy URL       | `https://www.kiroku.cz/privacy` |
| User Privacy Choices URL | empty (the field is optional)   |

Already correct on the new record: `clone-listing` copies the privacy policy URL
as part of the app info localizations, and it was in place before the
questionnaire was started.

## The shape of the questionnaire

ASC asks, in this order:

1. **Data Types.** One screen of checkboxes grouped by category. Tick every type
   the app collects. Thirteen are ticked here.
2. Then, **for each ticked type**, three questions:
   - **Data Use.** Which purposes? Choose from Third-Party Advertising,
     Developer's Advertising or Marketing, Analytics, Product Personalization,
     App Functionality, Other Purposes.
   - **Data Linkage.** Is it linked to the user's identity? Yes / No.
   - **Tracking.** Is it used for tracking purposes? Yes / No.

Every one of the thirteen answers **Linked: Yes** and **Tracking: No**, so the
only value that varies between types is the purpose set.

## The thirteen data types

Purposes are listed exactly as the ASC summary renders them. The order within a
row is ASC's display order and carries no meaning; tick the boxes in any order.

| #   | Category         | Data type           | Purposes                                              | Linked | Tracking |
| --- | ---------------- | ------------------- | ----------------------------------------------------- | ------ | -------- |
| 1   | Contact Info     | Name                | Analytics, Product Personalization, App Functionality | Yes    | No       |
| 2   | Contact Info     | Email Address       | Analytics, Product Personalization, App Functionality | Yes    | No       |
| 3   | Health & Fitness | Health              | App Functionality                                     | Yes    | No       |
| 4   | Location         | Precise Location    | App Functionality                                     | Yes    | No       |
| 5   | User Content     | Photos or Videos    | App Functionality                                     | Yes    | No       |
| 6   | User Content     | Other User Content  | Product Personalization, App Functionality, Analytics | Yes    | No       |
| 7   | Identifiers      | User ID             | App Functionality                                     | Yes    | No       |
| 8   | Identifiers      | Device ID           | App Functionality                                     | Yes    | No       |
| 9   | Purchases        | Purchase History    | App Functionality                                     | Yes    | No       |
| 10  | Usage Data       | Product Interaction | App Functionality                                     | Yes    | No       |
| 11  | Diagnostics      | Crash Data          | Analytics, App Functionality                          | Yes    | No       |
| 12  | Diagnostics      | Performance Data    | Analytics, Product Personalization, App Functionality | Yes    | No       |
| 13  | Other Data       | Other Data Types    | Product Personalization, App Functionality, Analytics | Yes    | No       |

Collapsed to the three distinct purpose sets, which is the faster way to enter
them:

- **App Functionality only** (7 types): Health, Precise Location, Photos or
  Videos, User ID, Device ID, Purchase History, Product Interaction.
- **Analytics + Product Personalization + App Functionality** (4 types): Name,
  Email Address, Other User Content, Performance Data. Other User Content and
  Other Data Types are the same set, rendered in a different order.
- **Analytics + App Functionality** (1 type): Crash Data.

Plus Other Data Types, which shares the three-purpose set above.

Nothing is declared under **Third-Party Advertising**, **Developer's Advertising
or Marketing** or **Other Purposes**, and no data type is marked as **not**
linked to identity.

### How the Tracking answer was established

The per-type Tracking answer is the one value the App Privacy summary page does
not print. It was read structurally rather than field by field, because opening
each type's editor on a retired record means opening a write form on it.

Two independent reads agree, and both are stronger than they look:

- The Product Page Preview renders **only** a "Data Linked to You" group. ASC
  renders a separate "Data Used to Track You" group whenever any type answers
  Tracking: Yes, and it is absent here.
- The app cannot answer Yes. Declaring tracking obliges the app to run the App
  Tracking Transparency prompt, and `NSUserTrackingUsageDescription` appears
  nowhere in `ios/`. There is no ad SDK, no IDFA access, and no attribution SDK
  in `package.json`. The third-party SDKs that do ship (Firebase Crashlytics,
  Firebase Performance, RevenueCat, Pusher) are all first-party-purpose.

## Where this disagrees with the code

Recorded so the next reader does not mistake transcription for endorsement.
**Do not act on any of this while rebuilding the label.** Copy the old answers,
get the new record submittable, then take these up on their own.

- **"Analytics" is claimed six times over, and no analytics SDK ships.**
  `@react-native-firebase/analytics` is not a dependency. Crashlytics and
  Performance are, and Apple does treat crash and performance reporting as
  Analytics, so Crash Data and Performance Data are fair. Name, Email Address,
  Other User Content and Other Data Types claiming Analytics look like
  over-declaration.
- **"Product Personalization" is claimed five times.** Kiroku personalises
  nothing beyond rendering the user's own data back to them, which is App
  Functionality.
- **Over-declaring is the safe direction.** A label that claims more than the app
  does is not a review failure; a label that claims less is. That is the reason
  to leave it alone during the migration rather than the reason it is right.
- **Health is the closest fit, not an exact one.** Drinking session data
  (timestamps, drink counts, units, notes, the blackout flag) has no dedicated
  Apple bucket. Health and Other Data Types are both defensible and the old
  record declares both.
- **Precise Location is opt-in and off by default**
  (`track_location_during_sessions`), which the label has no way to express.
  Declaring it is correct regardless: the capability exists in the binary.

## Rebuilding it on record `6670502234`

App Store Connect > Kiroku > App Privacy > **Get Started**, then work the table
above. The privacy policy URL is already set, so the questionnaire is the whole
job.

`Publish` is the button that makes it live, and it is the only irreversible step
here. Everything before it is a draft that can be edited freely.

Two things that are **not** part of this and are easy to conflate:

- The **age rating** questionnaire is a different screen and is already answered
  on the new record, including `socialMedia` and `socialMediaAgeRestricted`
  (both `false`). It is readable and writable through
  `/v1/ageRatingDeclarations`, unlike this.
- The **privacy policy URL** is copied by `clone-listing`. Only the data-type
  answers are manual.
