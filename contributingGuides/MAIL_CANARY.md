# Mail delivery canary

Every mail Kiroku sends (email verification, password reset, email-change
confirmation) is sent by **Firebase Authentication** on the app's behalf. The
client calls the Firebase SDK (`sendEmailVerification`, `sendPasswordResetEmail`,
`verifyBeforeUpdateEmail`), Identity Toolkit accepts the request, and Firebase
delivers the mail from the custom sender domain (`noreply@mail.kiroku.cz` in
production, `noreply@mail.dev.kiroku.cz` elsewhere; see the top of
`src/CONST.ts`) through whatever relay the Firebase console is configured with
(Authentication → Templates → SMTP settings). There is no SMTP code in this
repo.

That design has a blind spot: the client only learns whether Identity Toolkit
_accepted_ the send. A dead relay, a revoked SMTP key, a lapsed sender-domain
verification or a DMARC regression that sends everything to Spam all look the
same from the app: nothing arrives, no error anywhere.

The canary closes that gap. Once a day,
[`mailCanary.yml`](../.github/workflows/mailCanary.yml) runs
[`scripts/mail-canary.mjs`](../scripts/mail-canary.mjs), which

1. asks Identity Toolkit (the same REST endpoint the SDK uses, with the
   production web API key) to send a **password-reset** mail to a dedicated
   canary account;
2. watches that account's Gmail inbox over IMAP until the mail lands;
3. checks that it reached **INBOX, not Spam**, that the **From** address is the
   custom sender domain, that Gmail's `Authentication-Results` report
   **dkim=pass and dmarc=pass** (SPF is only a warning, since a relay's
   return-path may legitimately differ), and that the action link's **oobCode is
   valid**, verified against Identity Toolkit without consuming it;
4. moves the mail to Trash.

A failure posts to Discord through the shared `announceFailedWorkflowInDiscord`
action, names the failing stage in the job log (`✖ [stage] message`) and writes
a stage table to the job summary.

Password reset is probed because it needs no sign-in and shares the sender
domain and SMTP settings with the verification template, so it exercises the
same delivery chain. One mail a day is nothing against the quotas (150 reset
mails a day on Spark, 10,000 on Blaze).

## One-time setup

1. **Canary account.** Create a Firebase Auth user in the production project
   (`alcohol-tracker-db`, Authentication → Users → Add user) with a Gmail
   plus-address on the project's Gmail account, for example
   `kiroku.alcohol.tracker+canary@gmail.com`, and a long random password nobody
   keeps. Firebase treats the plus-address as its own account; Gmail delivers it
   to the base inbox. The account never signs in.
2. **App password.** On that Gmail account, turn on 2-Step Verification, then
   create an app password (Google Account → Security → 2-Step Verification →
   App passwords) named "Kiroku mail canary". Personal Gmail accounts still
   accept app passwords over IMAP; Google Workspace accounts do not. If Gmail
   settings still show an IMAP toggle, make sure it is on.
3. **Repository secrets.**

   | Secret                      | Value                                                                       |
   | --------------------------- | --------------------------------------------------------------------------- |
   | `MAIL_CANARY_EMAIL`         | the canary Firebase account, e.g. `kiroku.alcohol.tracker+canary@gmail.com` |
   | `MAIL_CANARY_IMAP_USER`     | the Gmail login, e.g. `kiroku.alcohol.tracker@gmail.com`                    |
   | `MAIL_CANARY_IMAP_PASSWORD` | the 16-character app password (spaces are fine)                             |

   `PRODUCTION_ENV_FILE` already exists; the job reads only its `API_KEY` line.

4. **Smoke it.** Run the workflow by hand from the Actions tab, or locally:

   ```bash
   CANARY_IMAP_USER=... CANARY_IMAP_PASSWORD=... node scripts/mail-canary.mjs imap-check
   CANARY_EMAIL=... CANARY_IMAP_USER=... CANARY_IMAP_PASSWORD=... \
     node scripts/mail-canary.mjs run --env-file .env.production
   ```

   `imap-check` signs in and lists the folders without sending anything.

## Reading a failure

| Stage            | What it means                                                                                                   | Where to look                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `usage`          | A secret is missing or empty.                                                                                   | Repository secrets.                                                                                   |
| `mailbox`        | IMAP sign-in failed. The app password was revoked (changing the Gmail password revokes all app passwords).      | Google Account → Security → App passwords; update `MAIL_CANARY_IMAP_PASSWORD`.                        |
| `send`           | Identity Toolkit refused the send: quota exhausted, account missing, rate-limited.                              | Google Cloud console → Quotas (Identity Toolkit); Firebase console → Authentication → Users.          |
| `arrival`        | Accepted, never delivered. The relay is down or silently dropping mail.                                         | Firebase console → Authentication → Templates → SMTP settings; the relay's own logs (Brevo).          |
| `spam`           | Delivered to Spam. Authentication or reputation problem.                                                        | The `Authentication-Results` line in the log; DNS for `mail.kiroku.cz` (SPF, DKIM); relay reputation. |
| `sender`         | The From address fell back to `@alcohol-tracker-db.firebaseapp.com`: the custom domain is no longer applied.    | Firebase console → Templates → the template's "customize domain" status.                              |
| `authentication` | DKIM or DMARC did not pass at Gmail. Other receivers will quarantine the mail (`kiroku.cz` has `p=quarantine`). | DNS: `firebase1/2._domainkey.mail.kiroku.cz`, `v=spf1` TXT; the relay's DKIM setup.                   |
| `link`           | The action link is missing or its oobCode is invalid.                                                           | The template's Action URL in the Firebase console.                                                    |

Scripted mails the canary finds in the inbox that are not its own (DMARC
aggregate reports, Firebase alerts) are ignored; mails older than the send are
too, so a backlog never produces a false pass.

## Caveats

- GitHub pauses scheduled workflows in repositories with no commits for 60
  days. Kiroku is active, but a paused schedule is silent; re-enable it from the
  Actions tab if it ever happens.
- Running the canary by hand many times in a row can trip Firebase's
  per-account rate limit on reset mails (`send` stage,
  `TOO_MANY_ATTEMPTS_TRY_LATER`). Wait an hour.
- The canary tests the production project only. Dev and adhoc builds send from
  `mail.dev.kiroku.cz` through the dev project's own templates.
- The script talks to the Firebase Auth emulator too: point
  `CANARY_IDENTITY_TOOLKIT_URL` at
  `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1`. The emulator does
  not deliver mail, so only the `send` stage is meaningful there.
