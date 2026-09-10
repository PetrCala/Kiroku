#!/usr/bin/env node
/**
 * Kiroku Google Play Console helper (zero-dependency).
 *
 * The Play-side counterpart of scripts/asc.mjs and scripts/asc-tips.mjs: it
 * reads what Play actually has, so release questions ("what's on open
 * testing?", "is the listing complete?") get answered from the console instead
 * of guessed, pushes the store listing from the repo, and creates the tip-jar
 * products. It reuses the fastlane service account
 * (android/app/android-fastlane-json-key.json) and mints the RS256 JWT with
 * Node's built-in crypto. It NEVER prints the key.
 *
 * Tracks and listings can only be read inside an edit, Play's transaction
 * around every app change. `status` opens one, reads from it, and deletes it.
 * It never commits, so nothing in the console changes, and an open edit does
 * not disturb other ones (a CI upload running at the same time is unaffected).
 * `promote`, `listing` and `screenshots` make all their changes in one edit
 * and commit it only with --yes. `tips` writes through the product APIs,
 * which sit outside edits, also only with --yes.
 *
 * Requires Node 18+ (global fetch), plus gpg when the key is only present
 * encrypted. No npm dependencies.
 *
 * Usage:
 *   node scripts/play.mjs status
 *   node scripts/play.mjs promote --version-code <code> [--track production]
 *        [--rollout <fraction>] [--notes-dir <dir>] [--yes]
 *   node scripts/play.mjs listing [--screenshots] [--lang <code>] [--yes]
 *   node scripts/play.mjs screenshots [--lang <code>] [--keep-tablet] [--yes]
 *   node scripts/play.mjs tips [--yes]
 *
 * Commands:
 *   status   Tracks and their releases (version codes decoded to the internal
 *            version, status, rollout, release-note lengths), the store
 *            listing per language (text lengths against Play's limits, icon /
 *            feature graphic / screenshot counts), the tip-jar products
 *            against CONST.TIPS.PRODUCT_IDS, and subscriptions. Ends with the
 *            gaps it found and the Play Console items the API cannot read.
 *            Writes nothing.
 *   promote  Put a build that is on the internal track onto another track
 *            (production by default) in one edit: the release gets that
 *            versionCode, the release notes from --notes-dir, and status
 *            completed, or inProgress at --rollout (0 < fraction < 1) for a
 *            staged rollout. A code already rolling out on the target track
 *            (e.g. from `:shipit:`) is ramped instead: rerun with a higher
 *            --rollout, or without it to complete. That works after a staging
 *            deploy has replaced internal, and keeps the release's notes
 *            unless new ones are found. Play validates the edit and the script prints
 *            what the track will hold afterwards. DRY RUN: without --yes the
 *            edit is thrown away; with --yes it is committed. This is how
 *            Android ships to production without `:shipit:` (see
 *            contributingGuides/philosophies/DEPLOYING.md).
 *   listing  Push title, short and full description for every language in
 *            fastlane/metadata/android/<lang>/ (title.txt,
 *            short_description.txt, full_description.txt, supply's layout).
 *            A language Play doesn't have yet is added. With --screenshots it
 *            also does what `screenshots` does, in the same edit.
 *   screenshots
 *            Replace each language's phone screenshots with the framed
 *            `play-phone` set (framed/<locale>/play-phone/, see
 *            scripts/store-screenshots.config.mjs; run
 *            `npm run frame-screenshots` first), in manifest order, and
 *            remove its 7" and 10" tablet screenshots. Play doesn't require
 *            tablet shots, and a stale set showing an old UI is worse than
 *            none; --keep-tablet leaves them alone.
 *   tips     Creates the tip-jar consumables (CONST.TIPS.PRODUCT_IDS) as
 *            one-time products, with the names, descriptions and CZK prices
 *            from scripts/asc-tips.mjs (en-US and cs-CZ listings). CZ gets the
 *            CZK price exactly; every other region gets Play's conversion of
 *            it (convertRegionPrices), as Apple derives its territories from
 *            CZE. Each product gets one legacy-compatible buy option, which is
 *            then activated. Idempotent: an existing product is never
 *            repriced, only given missing listings and an activated option.
 *            Falls back to the legacy in-app products API if the one-time
 *            products API is unavailable. DRY RUN unless --yes. Product ids
 *            are burn-once on Play too, so read the dry run first.
 *
 * Release notes: one <play-language>.txt per language (en-US.txt,
 * cs-CZ.txt), Play's 500-character limit enforced before anything is sent.
 * --notes-dir defaults to fastlane/play-release-notes/<MAJOR.MINOR.PATCH> of
 * the version code, and the release goes out without notes when neither
 * exists.
 *
 * `listing` and `screenshots` are dry runs without --yes too. A dry run still
 * makes every change, inside a throwaway edit that Play validates and that is
 * then deleted, so it catches what Play would reject without changing
 * anything in the console. Local files are checked before the key is loaded.
 *
 * Key: --key <path>, else $PLAY_KEY_JSON, else
 * android/app/android-fastlane-json-key.json. When only the .gpg copy exists
 * (the normal state of a checkout), it is decrypted in memory using
 * $LARGE_SECRET_PASSPHRASE, or a hidden prompt for it when that is unset. The
 * plaintext key is never written to disk.
 *
 * Flags:
 *   --package <id>        Play package name (default: com.alcohol_tracker)
 *   --key <path>          service account JSON key (see Key above)
 *   --version-code <code> promote: the build to ship (on internal, or already
 *                         rolling out on --track); the code (1001000008) or
 *                         the version (1.0.0-8)
 *   --track <name>        promote: target track (default: production)
 *   --rollout <fraction>  promote: staged rollout share, e.g. 0.2
 *   --notes-dir <dir>     promote: release notes directory (see above)
 *   --lang <code>         listing / screenshots: only this Play language
 *   --screenshots         listing: also replace the screenshots, same edit
 *   --keep-tablet         screenshots: keep the existing tablet screenshots
 *   --yes                 promote / listing / screenshots: commit the edit
 *                         instead of a dry run; tips: actually write
 *   --help, -h            show this help
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// eslint-disable-next-line import/extensions -- Node ESM requires the explicit extension
import TIPS from './asc-tips.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE =
  'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
// Media (image) uploads go to a separate host path.
const UPLOAD_BASE =
  'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const DEFAULT_PACKAGE = 'com.alcohol_tracker';
// Play's hard limits: the console rejects anything longer.
const LIMITS = {
  title: 30,
  shortDescription: 80,
  fullDescription: 4000,
  releaseNotes: 500,
};
// Play refuses to publish a listing with fewer than two screenshots, and
// Kiroku is a phone app, so they have to be phone ones.
const MIN_PHONE_SCREENSHOTS = 2;
const IMAGE_TYPES = [
  ['icon', 'icon'],
  ['featureGraphic', 'feature graphic'],
  ['phoneScreenshots', 'phone'],
  ['sevenInchScreenshots', '7" tablet'],
  ['tenInchScreenshots', '10" tablet'],
];
const TRACK_ORDER = ['production', 'beta', 'alpha', 'internal'];
// Where `promote` looks for release notes when --notes-dir is not given. Kept
// out of fastlane/metadata/android, where supply would read any folder as a
// listing language.
const NOTES_ROOT = path.join(ROOT, 'fastlane', 'play-release-notes');
// What Play keeps behind the console UI: the API either cannot read these at
// all (Data safety is write-only) or has no endpoint for them.
const CONSOLE_ONLY = [
  'Data safety form',
  'Content rating (IARC questionnaire)',
  'Target audience and content (18+)',
  'App access (reviewer demo account)',
  'Ads declaration',
  'Health apps declaration',
  'Account deletion web URL',
  'Managed publishing, and anything waiting in Publishing overview',
  'Production access (Dashboard)',
];
const L = (s = '') => console.log(s);

// ---- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const cmd = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
function flag(name, def) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const OPTS = {
  packageName: flag('package', process.env.PLAY_PACKAGE || DEFAULT_PACKAGE),
  keyPath: flag(
    'key',
    process.env.PLAY_KEY_JSON ||
      path.join(ROOT, 'android', 'app', 'android-fastlane-json-key.json'),
  ),
  help: argv.includes('--help') || argv.includes('-h'),
  yes: argv.includes('--yes'),
};

function usage() {
  // The header comment only, not every JSDoc block further down.
  const source = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  L(
    source
      .slice(0, source.indexOf(' */'))
      .split('\n')
      .filter(l => l.startsWith(' *'))
      .map(l => l.slice(3))
      .join('\n'),
  );
}

// ---- key --------------------------------------------------------------------
/** Read a line from the terminal without echoing it. */
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const {stdin} = process;
    if (!stdin.isTTY) {
      reject(
        new Error('No terminal to prompt on; set LARGE_SECRET_PASSPHRASE'),
      );
      return;
    }
    process.stderr.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = chunk => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.off('data', onData);
          stdin.setRawMode(false);
          stdin.pause();
          process.stderr.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          stdin.setRawMode(false);
          process.stderr.write('\n');
          process.exit(130);
        }
        value =
          ch === '\u007f' || ch === '\b' ? value.slice(0, -1) : value + ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function loadKey() {
  let text;
  if (fs.existsSync(OPTS.keyPath)) {
    text = fs.readFileSync(OPTS.keyPath, 'utf8');
  } else {
    const gpgPath = `${OPTS.keyPath}.gpg`;
    if (!fs.existsSync(gpgPath))
      throw new Error(
        `No service account key at ${OPTS.keyPath} or ${gpgPath}`,
      );
    const passphrase =
      process.env.LARGE_SECRET_PASSPHRASE ||
      (await promptHidden(
        `Passphrase for ${path.relative(ROOT, gpgPath)} (LARGE_SECRET_PASSPHRASE): `,
      ));
    const r = spawnSync(
      'gpg',
      [
        '--quiet',
        '--batch',
        '--yes',
        '--pinentry-mode',
        'loopback',
        '--passphrase-fd',
        '0',
        '--decrypt',
        gpgPath,
      ],
      {input: passphrase, encoding: 'utf8'},
    );
    if (r.error) throw new Error(`Could not run gpg: ${r.error.message}`);
    if (r.status !== 0)
      throw new Error(
        `gpg could not decrypt ${gpgPath} (wrong passphrase?)\n${r.stderr.trim()}`,
      );
    text = r.stdout;
  }
  const k = JSON.parse(text);
  if (!k.client_email || !k.private_key)
    throw new Error(`Key JSON missing client_email/private_key`);
  return k;
}

// ---- auth (RS256 JWT -> OAuth access token, no deps) -----------------------
const b64url = input =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
async function getAccessToken(k) {
  const tokenUri = k.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(
    JSON.stringify({alg: 'RS256', typ: 'JWT', kid: k.private_key_id}),
  );
  const payload = b64url(
    JSON.stringify({
      iss: k.client_email,
      scope: SCOPE,
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const sig = crypto.sign(
    'RSA-SHA256',
    Buffer.from(`${header}.${payload}`),
    k.private_key,
  );
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${payload}.${b64url(sig)}`,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token)
    throw new Error(
      `Token exchange failed: HTTP ${res.status} ${body.error ?? ''} ${body.error_description ?? ''}`.trim(),
    );
  return body.access_token;
}

let TOKEN;
/**
 * `body` is sent as JSON. An image upload passes raw `data` with its
 * `contentType` instead, and goes to the upload host.
 */
async function api(method, p, body, {data, contentType, upload} = {}) {
  const url = `${upload ? UPLOAD_BASE : BASE}/${encodeURIComponent(OPTS.packageName)}${p}`;
  // Google answers a bodiless POST with 411 Length Required.
  const payload = body ?? (method === 'POST' ? {} : undefined);
  let raw = data;
  if (raw === undefined && payload !== undefined) raw = JSON.stringify(payload);
  // A dropped connection, a 5xx or a 429 is retried twice. Image uploads are
  // not: retrying an upload that did land would add the image twice. The rest
  // is safe to repeat: reads, create-if-missing, activate, and edit writes that
  // replace rather than append.
  const maxAttempts = upload ? 1 : 3;
  const pause = attempt =>
    new Promise(resolve => {
      setTimeout(resolve, 1000 * attempt);
    });
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': contentType ?? 'application/json',
        },
        body: raw,
      });
    } catch (err) {
      // A dropped connection throws ("fetch failed") instead of answering.
      if (attempt >= maxAttempts)
        throw new Error(`${method} ${p}: ${err.cause?.message ?? err.message}`);

      await pause(attempt);
      continue;
    }

    const text = await res.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {raw: text};
    }
    if (res.ok) return parsed;
    if ((res.status >= 500 || res.status === 429) && attempt < maxAttempts) {
      await pause(attempt);
      continue;
    }
    const err = new Error(
      `HTTP ${res.status} ${method} ${p}: ${parsed.error?.message ?? text}`,
    );
    err.status = res.status;
    throw err;
  }
}

// ---- repo facts -------------------------------------------------------------
function repoVersionCode() {
  const gradle = fs.readFileSync(
    path.join(ROOT, 'android', 'app', 'build.gradle'),
    'utf8',
  );
  return /versionCode\s+(\d+)/.exec(gradle)?.[1] ?? null;
}

/**
 * The internal version a versionCode stands for. The bump scripts encode
 * MAJOR.MINOR.PATCH-BUILD as `10` + two digits each, so 1001000008 is 1.0.0-8
 * and 1000032315 is 0.3.23-15. Anything else is printed as the bare code.
 */
function decodeVersionCode(code) {
  const s = String(code);
  if (s.length !== 10 || !s.startsWith('10')) return null;
  const [major, minor, patch, build] = [2, 4, 6, 8].map(i =>
    Number(s.slice(i, i + 2)),
  );
  return `${major}.${minor}.${patch}-${build}`;
}

/**
 * The reverse of decodeVersionCode: 1.0.0-10 (or the iOS form 1.0.0.10)
 * becomes 1001000010. A bare number passes through, anything else is null.
 */
function encodeVersionCode(input) {
  const s = String(input);
  if (/^\d+$/.test(s)) return s;
  const parts = /^(\d{1,2})\.(\d{1,2})\.(\d{1,2})[-.](\d{1,2})$/.exec(s);
  return parts
    ? `10${parts
        .slice(1)
        .map(p => p.padStart(2, '0'))
        .join('')}`
    : null;
}
const showCode = code => {
  const v = decodeVersionCode(code);
  return v ? `${code} = ${v}` : String(code);
};

/**
 * The tip product ids, read from src/CONST.ts rather than repeated here, the
 * same way scripts/revenuecat.mjs does.
 */
function tipProductIds() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'CONST.ts'), 'utf8');
  const block = /TIPS:\s*{\s*PRODUCT_IDS:\s*\[([^\]]*)\]/.exec(src);
  if (!block)
    throw new Error('Could not find CONST.TIPS.PRODUCT_IDS in src/CONST.ts');
  return [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

// ---- status -----------------------------------------------------------------
function printTracks(tracks, versionCode, gaps, title = 'Tracks') {
  L(title);
  const rank = t => {
    const i = TRACK_ORDER.indexOf(t.track);
    return i === -1 ? TRACK_ORDER.length : i;
  };
  const sorted = [...tracks].sort(
    (a, b) => rank(a) - rank(b) || a.track.localeCompare(b.track),
  );
  for (const t of sorted) {
    const releases = t.releases ?? [];
    if (!releases.length) {
      L(`  ${t.track.padEnd(12)} (no releases)`);
      continue;
    }
    releases.forEach((r, i) => {
      const codes = (r.versionCodes ?? []).map(showCode).join(', ') || '-';
      const rollout =
        r.userFraction === undefined
          ? ''
          : `, ${Math.round(r.userFraction * 100)}% rollout`;
      const isRepo =
        versionCode && r.versionCodes?.includes(versionCode) ? '  <- repo' : '';
      L(
        `  ${(i === 0 ? t.track : '').padEnd(12)} ${(r.status ?? '?').padEnd(11)} ${r.name ?? '(unnamed)'} [${codes}]${rollout}${isRepo}`,
      );
      for (const n of r.releaseNotes ?? []) {
        const over = n.text.length > LIMITS.releaseNotes ? '  OVER LIMIT' : '';
        L(
          `  ${''.padEnd(24)} notes ${n.language}: ${n.text.length}/${LIMITS.releaseNotes}${over}`,
        );
      }
    });
  }

  const live = tracks
    .find(t => t.track === 'production')
    ?.releases?.some(
      r => r.status === 'completed' || r.status === 'inProgress',
    );
  if (!live) gaps.push('Nothing is live on the production track.');
  const onATrack = tracks.some(t =>
    t.releases?.some(r => r.versionCodes?.includes(versionCode)),
  );
  if (versionCode && !onATrack)
    gaps.push(
      `Repo versionCode ${showCode(versionCode)} is on no track (staging deploy not uploaded yet?).`,
    );
}

async function printListings(listings, defaultLanguage, readEdit, gaps) {
  L('Store listing');
  if (!listings.length) {
    L('  (no listings)');
    gaps.push('No store listing text in any language.');
    return;
  }
  const withImages = await Promise.all(
    listings.map(async listing => {
      const counts = await Promise.all(
        IMAGE_TYPES.map(([type]) =>
          readEdit(`/listings/${listing.language}/${type}`).then(
            r => (r.images ?? []).length,
          ),
        ),
      );
      return {
        listing,
        counts: Object.fromEntries(IMAGE_TYPES.map(([t], i) => [t, counts[i]])),
      };
    }),
  );

  for (const {listing, counts} of withImages) {
    const lang = listing.language;
    const isDefault = lang === defaultLanguage;
    const text = ['title', 'shortDescription', 'fullDescription'].map(field => {
      const len = (listing[field] ?? '').length;
      if (len > LIMITS[field]) gaps.push(`${lang}: ${field} over the limit.`);
      if (!len && field !== 'title') gaps.push(`${lang}: ${field} is empty.`);
      return `${field} ${len}/${LIMITS[field]}`;
    });
    L(`  ${lang}${isDefault ? ' (default)' : ''}  ${text.join(', ')}`);
    L(
      `  ${''.padEnd(lang.length)}  ${IMAGE_TYPES.map(([t, label]) => `${label} ${counts[t]}`).join(', ')}`,
    );

    // A language without its own images shows the default language's in the
    // store, so only the default listing has to carry them.
    if (!isDefault) continue;
    if (counts.phoneScreenshots < MIN_PHONE_SCREENSHOTS)
      gaps.push(
        `${lang}: ${counts.phoneScreenshots} phone screenshots, Play needs at least ${MIN_PHONE_SCREENSHOTS}.`,
      );
    if (!counts.featureGraphic) gaps.push(`${lang}: no feature graphic.`);
    if (!counts.icon) gaps.push(`${lang}: no store icon.`);
  }
}

/** productId -> state, from the one-time products API or the older one. */
async function listOneTimeProducts() {
  const out = new Map();
  try {
    let pageToken;
    do {
      const q = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';

      const r = await api('GET', `/oneTimeProducts${q}`);
      for (const p of r.oneTimeProducts ?? []) {
        const states = [
          ...new Set((p.purchaseOptions ?? []).map(o => o.state)),
        ];
        out.set(p.productId, states.join('/') || 'NO_PURCHASE_OPTIONS');
      }
      pageToken = r.nextPageToken;
    } while (pageToken);
    return out;
  } catch (err) {
    if (err.status !== 400 && err.status !== 404) throw err;
  }
  const r = await api('GET', '/inappproducts');
  for (const p of r.inappproduct ?? []) out.set(p.sku, p.status ?? '?');
  return out;
}

async function printProducts(gaps) {
  L('Tip jar (CONST.TIPS.PRODUCT_IDS)');
  const wanted = tipProductIds();
  try {
    const found = await listOneTimeProducts();
    for (const id of wanted)
      L(`  ${id.padEnd(28)} ${found.get(id) ?? 'MISSING'}`);
    const missing = wanted.filter(id => !found.has(id));
    if (missing.length)
      gaps.push(
        `Tip products missing on Play (${missing.join(', ')}), so Android shows the tip jar's unavailable state.`,
      );
    const extra = [...found.keys()].filter(id => !wanted.includes(id));
    if (extra.length) L(`  also on Play: ${extra.join(', ')}`);
  } catch (err) {
    L(`  could not read: ${err.message}`);
    gaps.push(
      'Could not read in-app products (the service account may lack the financial data permission).',
    );
  }

  L();
  L('Subscriptions');
  try {
    const {subscriptions = []} = await api('GET', '/subscriptions');
    if (!subscriptions.length) L('  (none)');
    for (const s of subscriptions) {
      const plans = (s.basePlans ?? [])
        .map(b => `${b.basePlanId}:${b.state}`)
        .join(', ');
      L(`  ${s.productId.padEnd(28)} ${plans || '(no base plans)'}`);
    }
  } catch (err) {
    L(`  could not read: ${err.message}`);
  }
}

async function cmdStatus() {
  const gaps = [];
  const versionCode = repoVersionCode();
  const edit = await api('POST', '/edits');
  try {
    const readEdit = p => api('GET', `/edits/${edit.id}${p}`);
    const [details, {tracks = []}, {listings = []}] = await Promise.all([
      readEdit('/details'),
      readEdit('/tracks'),
      readEdit('/listings'),
    ]);

    L(
      `App ${OPTS.packageName} (default language ${details.defaultLanguage ?? '?'}, contact ${details.contactEmail ?? 'none'})`,
    );
    L(
      `Repo versionCode ${versionCode ? showCode(versionCode) : '?'} (android/app/build.gradle)`,
    );
    L();
    printTracks(tracks, versionCode, gaps);
    L();
    await printListings(listings, details.defaultLanguage, readEdit, gaps);
  } finally {
    await api('DELETE', `/edits/${edit.id}`).catch(err =>
      console.error(
        `WARN could not delete edit ${edit.id} (it expires on its own): ${err.message}`,
      ),
    );
  }

  L();
  await printProducts(gaps);

  L();
  L(gaps.length ? 'Gaps' : 'Gaps: none found');
  for (const g of gaps) L(`  - ${g}`);
  L();
  L('Not readable over the API, check in Play Console:');
  for (const c of CONSOLE_ONLY) L(`  - ${c}`);
}

// ---- promote ----------------------------------------------------------------
/** A flag that must carry a value, or undefined when it is absent. */
function valueFlag(name) {
  const v = flag(name);
  if (v === true) throw new Error(`--${name} needs a value`);
  return v;
}

/**
 * Release notes as Play wants them, [{language, text}], from one
 * <language>.txt per language. Fails when any text is over Play's limit, so a
 * bad file is caught before an edit is even opened.
 */
function readReleaseNotes(versionCode) {
  const explicit = valueFlag('notes-dir');
  const version = decodeVersionCode(versionCode)?.split('-')[0];
  const dir = explicit
    ? path.resolve(explicit)
    : version && path.join(NOTES_ROOT, version);
  if (!dir || !fs.existsSync(dir)) {
    if (explicit) throw new Error(`No release notes directory at ${dir}`);
    return {dir: null, notes: []};
  }
  const notes = fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.txt'))
    .sort()
    .map(f => ({
      language: f.slice(0, -'.txt'.length),
      text: fs.readFileSync(path.join(dir, f), 'utf8').trim(),
    }));
  if (!notes.length) throw new Error(`No <language>.txt files in ${dir}`);
  const bad = notes.filter(n => !n.text || n.text.length > LIMITS.releaseNotes);
  if (bad.length)
    throw new Error(
      `Release notes must be 1 to ${LIMITS.releaseNotes} characters: ${bad
        .map(n => `${n.language} has ${n.text.length}`)
        .join(', ')}`,
    );
  return {dir, notes};
}

/** Everything promote can check offline, so bad input fails before the key. */
function promoteArgs() {
  const versionCode = encodeVersionCode(valueFlag('version-code') ?? '');
  if (!versionCode)
    throw new Error(
      'promote needs --version-code <code or version>, e.g. 1001000008 or 1.0.0-8 (see `status` for what internal has)',
    );
  const track = valueFlag('track') ?? 'production';
  if (track === 'internal')
    throw new Error('The build is taken from internal; pick another --track');
  const rollout = valueFlag('rollout');
  const userFraction = rollout === undefined ? undefined : Number(rollout);
  if (userFraction !== undefined && !(userFraction > 0 && userFraction < 1))
    throw new Error(
      '--rollout is the share of users as a fraction between 0 and 1 (e.g. 0.2); leave it out for a full rollout',
    );
  return {versionCode, track, userFraction, ...readReleaseNotes(versionCode)};
}

async function cmdPromote({versionCode, track, userFraction, dir, notes}) {
  L(
    `${OPTS.yes ? 'PROMOTING' : 'DRY RUN (add --yes to commit)'}: ${showCode(versionCode)} -> ${track}`,
  );
  if (dir) {
    L(`Release notes from ${path.relative(ROOT, dir) || dir}`);
    for (const n of notes)
      L(`  ${n.language}: ${n.text.length}/${LIMITS.releaseNotes}`);
  } else {
    L(
      `WARN no release notes (no --notes-dir and no ${path.relative(ROOT, NOTES_ROOT)}/<version>)`,
    );
  }
  L();

  const edit = await api('POST', '/edits');
  let committed = false;
  try {
    const readEdit = p => api('GET', `/edits/${edit.id}${p}`);
    const [{tracks = []}, {listings = []}] = await Promise.all([
      readEdit('/tracks'),
      readEdit('/listings'),
    ]);

    const releaseWith = name =>
      tracks
        .find(t => t.track === name)
        ?.releases?.find(r => r.versionCodes?.includes(versionCode));
    // A release already on the target track is a staged rollout being ramped
    // (a staging deploy may have replaced internal by then); otherwise the
    // build is promoted from internal.
    const onTarget = releaseWith(track);
    const source = onTarget ?? releaseWith('internal');
    if (!source) {
      const onInternal = (
        tracks.find(t => t.track === 'internal')?.releases ?? []
      )
        .flatMap(r => r.versionCodes ?? [])
        .map(showCode);
      throw new Error(
        `${showCode(versionCode)} is neither on the internal track (internal has: ${onInternal.join(', ') || 'nothing'}) nor rolling out on ${track}`,
      );
    }
    if (onTarget?.status === 'completed')
      throw new Error(
        `${showCode(versionCode)} is already fully rolled out on ${track}`,
      );
    L(
      onTarget
        ? `Ramping the ${onTarget.status} release already on ${track} (${Math.round((onTarget.userFraction ?? 0) * 100)}% now)`
        : 'Promoting from the internal track',
    );
    const releaseNotes = notes.length ? notes : onTarget?.releaseNotes ?? [];
    if (!notes.length && releaseNotes.length)
      L(`Keeping the release notes already on the ${track} release`);
    const listed = new Set(listings.map(l => l.language));
    for (const n of notes)
      if (!listed.has(n.language))
        L(`WARN ${n.language} has release notes but no store listing`);

    const current = tracks.find(t => t.track === track) ?? {
      track,
      releases: [],
    };
    printTracks([current], versionCode, [], `Play has now`);
    L();

    const release = {
      name: source.name,
      versionCodes: [versionCode],
      status: userFraction === undefined ? 'completed' : 'inProgress',
      ...(userFraction !== undefined && {userFraction}),
      ...(releaseNotes.length && {releaseNotes}),
    };
    // A staged rollout serves the new build to a share of users and the
    // current completed release to everyone else, so that one has to stay
    // on the track. A full release replaces everything on it.
    const kept =
      userFraction === undefined
        ? []
        : (current.releases ?? []).filter(r => r.status === 'completed');
    await api('PUT', `/edits/${edit.id}/tracks/${encodeURIComponent(track)}`, {
      track,
      releases: [release, ...kept],
    });
    await api('POST', `/edits/${edit.id}:validate`);
    const after = await readEdit(`/tracks/${encodeURIComponent(track)}`);
    printTracks(
      [after],
      versionCode,
      [],
      OPTS.yes
        ? 'Play will have (edit committed)'
        : 'Play would have (validated by Play, not committed)',
    );

    if (OPTS.yes) {
      await api('POST', `/edits/${edit.id}:commit`);
      committed = true;
    }
  } finally {
    if (!committed)
      await api('DELETE', `/edits/${edit.id}`).catch(err =>
        console.error(
          `WARN could not delete edit ${edit.id} (it expires on its own): ${err.message}`,
        ),
      );
  }

  L();
  if (!OPTS.yes) {
    L('Nothing changed on Play. Re-run with --yes to commit this edit.');
    return;
  }
  L(`Committed. The ${track} release goes to Google review.`);
  L(
    'If Managed publishing is on (Publishing overview in Play Console), the release is still held after review until you publish it there.',
  );
}

// ---- listing / screenshots --------------------------------------------------
const METADATA_DIR = path.join(ROOT, 'fastlane', 'metadata', 'android');
// supply's file names, so fastlane and this script read the same layout.
const TEXT_FILES = {
  title: 'title.txt',
  shortDescription: 'short_description.txt',
  fullDescription: 'full_description.txt',
};
// Play's cap per screenshot type, and its size rules for each image.
const MAX_PHONE_SCREENSHOTS = 8;
const SCREENSHOT_SIDE = {min: 320, max: 3840};
const SCREENSHOT_MAX_BYTES = 8 * 1024 * 1024;
const TABLET_TYPES = ['sevenInchScreenshots', 'tenInchScreenshots'];

/** The listing text per language, from fastlane/metadata/android/<lang>/. */
function readLocalListings(onlyLang, errors) {
  const langs = fs
    .readdirSync(METADATA_DIR, {withFileTypes: true})
    .filter(d => d.isDirectory() && (!onlyLang || d.name === onlyLang))
    .map(d => d.name)
    .sort();
  const out = [];
  for (const lang of langs) {
    const files = Object.entries(TEXT_FILES);
    const has = f => fs.existsSync(path.join(METADATA_DIR, lang, f));
    // A folder holding only images/ is not a listing to push.
    if (!files.some(([, f]) => has(f))) continue;
    const fields = {};
    for (const [field, file] of files) {
      if (!has(file)) {
        errors.push(`${lang}: missing ${file}`);
        continue;
      }
      const value = fs
        .readFileSync(path.join(METADATA_DIR, lang, file), 'utf8')
        .trim();
      if (!value) errors.push(`${lang}: ${file} is empty`);
      if (value.length > LIMITS[field])
        errors.push(
          `${lang}: ${file} is ${value.length} characters, Play allows ${LIMITS[field]}`,
        );
      fields[field] = value;
    }
    out.push({lang, fields});
  }
  if (!out.length)
    errors.push(
      `No listing text in ${path.relative(ROOT, METADATA_DIR)}${onlyLang ? ` for ${onlyLang}` : ''}`,
    );
  return out;
}

/** Width and height from a PNG's IHDR chunk, or null for anything else. */
function pngSize(file) {
  const buf = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, buf, 0, 24, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  return {width: buf.readUInt32BE(16), height: buf.readUInt32BE(20)};
}

/**
 * The framed Play phone set per Play language: the `store: 'play'` device of
 * scripts/store-screenshots.config.mjs, read from framed/<locale>/<device>/,
 * with the framing locale mapped through its `playLocales`.
 */
async function readLocalScreenshots(onlyLang, errors) {
  // eslint-disable-next-line import/extensions -- Node ESM requires the explicit extension
  const {default: cfg} = await import('./store-screenshots.config.mjs');
  const device = cfg.devices.find(d => d.store === 'play');
  if (!device) {
    errors.push(
      "No `store: 'play'` device in scripts/store-screenshots.config.mjs",
    );
    return [];
  }
  const expected = cfg.shots.filter(
    s => (s.kind ?? 'phone') === device.kind,
  ).length;
  const reframe = `npm run frame-screenshots -- --device ${device.id}`;
  const out = [];
  for (const [locale, lang] of Object.entries(cfg.playLocales)) {
    if (onlyLang && lang !== onlyLang) continue;
    const dir = path.join(ROOT, cfg.OUT_DIR, locale, device.id);
    const files = fs.existsSync(dir)
      ? fs
          .readdirSync(dir)
          .filter(f => f.endsWith('.png'))
          .sort()
          .map(f => path.join(dir, f))
      : [];
    // Framing wipes the folder first, so a count off from the manifest means
    // a partial render (missing captures), not leftovers.
    if (files.length !== expected) {
      errors.push(
        `${lang}: ${files.length} screenshots in ${path.relative(ROOT, dir)}, the manifest has ${expected} (run ${reframe})`,
      );
      continue;
    }
    if (
      files.length < MIN_PHONE_SCREENSHOTS ||
      files.length > MAX_PHONE_SCREENSHOTS
    )
      errors.push(
        `${lang}: ${files.length} screenshots, Play takes ${MIN_PHONE_SCREENSHOTS} to ${MAX_PHONE_SCREENSHOTS}`,
      );
    for (const file of files) {
      const name = path.relative(ROOT, file);
      const size = pngSize(file);
      if (!size) {
        errors.push(`${name} is not a PNG`);
        continue;
      }
      const short = Math.min(size.width, size.height);
      const long = Math.max(size.width, size.height);
      if (
        short < SCREENSHOT_SIDE.min ||
        long > SCREENSHOT_SIDE.max ||
        long > 2 * short
      )
        errors.push(
          `${name} is ${size.width}x${size.height}; Play needs each side ${SCREENSHOT_SIDE.min} to ${SCREENSHOT_SIDE.max} px and at most 2:1`,
        );
      if (fs.statSync(file).size > SCREENSHOT_MAX_BYTES)
        errors.push(`${name} is over Play's 8 MB limit`);
    }
    out.push({lang, files});
  }
  if (!out.length && !errors.length)
    errors.push(`No Play language matches ${onlyLang}`);
  return out;
}

/**
 * Commit an edit. When Play won't send changes for review automatically (the
 * app uses managed publishing, or has changes Play wants sent by hand), a plain
 * commit fails and names changesNotSentForReview. Committing with it keeps the
 * changes, waiting in Publishing overview for someone to send them.
 */
async function commitEdit(id) {
  try {
    await api('POST', `/edits/${id}:commit`);
    L('Committed. Play reviews listing changes before they go live.');
  } catch (err) {
    if (!/changesNotSentForReview/.test(err.message)) throw err;
    await api('POST', `/edits/${id}:commit?changesNotSentForReview=true`);
    L(
      'Committed, not yet sent for review (Play would not send it automatically). Send it from Play Console > Publishing overview.',
    );
  }
}

/** The offline half of `listing` / `screenshots`: read and check local files. */
async function pushArgs({text, images}) {
  const langFlag = flag('lang');
  const onlyLang = typeof langFlag === 'string' ? langFlag : null;
  const errors = [];
  const listings = text ? readLocalListings(onlyLang, errors) : [];
  const shotSets = images ? await readLocalScreenshots(onlyLang, errors) : [];
  if (errors.length)
    throw new Error(
      `Local files are not ready:\n${errors.map(e => `  - ${e}`).join('\n')}`,
    );
  return {listings, shotSets};
}

async function cmdPush({listings, shotSets}) {
  const keepTablet = argv.includes('--keep-tablet');
  L(OPTS.yes ? 'Applying (--yes).' : 'DRY RUN (add --yes to commit).');
  L();
  const edit = await api('POST', '/edits');
  const at = p => `/edits/${edit.id}${p}`;
  let committed = false;
  try {
    const {listings: current = []} = await api('GET', at('/listings'));
    const onPlay = new Map(current.map(l => [l.language, l]));

    // Sequential throughout: each step prints what it changed, and Play orders
    // a type's images by upload order.
    for (const {lang, fields} of listings) {
      const before = onPlay.get(lang);
      L(`${lang}  listing text${before ? '' : ' (new language)'}`);
      for (const [field, value] of Object.entries(fields)) {
        const old = before?.[field] ?? '';
        let change = `${old.length} -> ${value.length} chars`;
        if (old === value) change = 'unchanged';
        else if (field === 'title') change = `"${old}" -> "${value}"`;
        L(`  ${field.padEnd(17)} ${change}`);
      }
      // PUT replaces the listing, so carry over the fields we don't manage
      // (the promo video).
      const next = {...before, language: lang, ...fields};
      await api('PUT', at(`/listings/${lang}`), next);
      onPlay.set(lang, next);
    }

    for (const {lang, files} of shotSets) {
      if (!onPlay.has(lang))
        throw new Error(
          `${lang} has no listing on Play yet. Push its text first: listing --screenshots`,
        );
      const count = async type =>
        ((await api('GET', at(`/listings/${lang}/${type}`))).images ?? [])
          .length;
      L(
        `${lang}  phone screenshots ${await count('phoneScreenshots')} -> ${files.length}`,
      );
      await api('DELETE', at(`/listings/${lang}/phoneScreenshots`));
      for (const file of files) {
        await api(
          'POST',
          at(`/listings/${lang}/phoneScreenshots?uploadType=media`),
          undefined,
          {upload: true, data: fs.readFileSync(file), contentType: 'image/png'},
        );
        L(`  + ${path.relative(ROOT, file)}`);
      }
      for (const type of TABLET_TYPES) {
        const n = await count(type);
        if (!n) continue;
        if (keepTablet) {
          L(`  ${type} ${n} kept (--keep-tablet)`);
          continue;
        }
        await api('DELETE', at(`/listings/${lang}/${type}`));
        L(`  ${type} ${n} -> 0`);
      }
    }

    await api('POST', at(':validate'));
    L();
    L('Play validated the edit.');
    if (!OPTS.yes) {
      L('DRY RUN: discarding it, nothing changed. Re-run with --yes to apply.');
      return;
    }
    await commitEdit(edit.id);
    committed = true;
  } finally {
    if (!committed)
      await api('DELETE', `/edits/${edit.id}`).catch(err =>
        console.error(
          `WARN could not delete edit ${edit.id} (it expires on its own): ${err.message}`,
        ),
      );
  }
}

// ---- tips -------------------------------------------------------------------
// asc-tips.mjs keys Czech the way App Store Connect does; Play wants a region.
const PLAY_LANGUAGE = {cs: 'cs-CZ'};
// The one purchase option each tip has. Immutable once created.
const TIP_OPTION = 'tip';
// Where the CZK prices in asc-tips.mjs apply, like Apple's CZE base territory.
const BASE_REGION = 'CZ';
const SAMPLE_REGIONS = ['CZ', 'US', 'DE', 'GB', 'JP'];

/**
 * The asc-tips.mjs table, checked against CONST.TIPS.PRODUCT_IDS: the app asks
 * the store for exactly those ids, so a mismatch here would create a product
 * nobody requests, under an id that can never be reused.
 */
function tipDefinitions() {
  const ids = tipProductIds();
  const byId = new Map(TIPS.map(t => [t.productId, t]));
  const missing = ids.filter(id => !byId.has(id));
  const extra = TIPS.map(t => t.productId).filter(id => !ids.includes(id));
  if (missing.length || extra.length)
    throw new Error(
      `scripts/asc-tips.mjs TIPS and CONST.TIPS.PRODUCT_IDS disagree ` +
        `(not in TIPS: ${missing.join(', ') || 'none'}; not in CONST: ${extra.join(', ') || 'none'}). Fix that first.`,
    );
  return ids.map(id => byId.get(id));
}

const playListings = tip =>
  Object.entries(tip.locales).map(([locale, copy]) => ({
    languageCode: PLAY_LANGUAGE[locale] ?? locale,
    title: copy.name,
    description: copy.description,
  }));

function money(currencyCode, amount) {
  const cents = Math.round(amount * 100);
  return {
    currencyCode,
    units: String(Math.floor(cents / 100)),
    nanos: (cents % 100) * 1e7,
  };
}
const amountOf = m => Number(m.units ?? 0) + (m.nanos ?? 0) / 1e9;
// From the string parts, so 1 unit + 890000000 nanos prints 1.89, not a float.
const showMoney = m => {
  const fraction = String(m.nanos ?? 0)
    .padStart(9, '0')
    .replace(/0+$/, '');
  return `${m.units ?? 0}${fraction ? `.${fraction}` : ''} ${m.currencyCode}`;
};

/**
 * Every region's price for one tip. convertRegionPrices takes a tax-exclusive
 * price and returns tax-inclusive ones, while the CZK prices are what a Czech
 * buyer pays (as on the App Store). So a first call measures Czech VAT, a
 * second converts from the net price that lands on `czk` gross, and CZ is
 * pinned to `czk` so Play's rounding cannot move the anchor.
 */
async function convertTipPrices(czk) {
  const convert = amount =>
    api('POST', '/pricing:convertRegionPrices', {price: money('CZK', amount)});
  const probe = await convert(czk);
  const gross = probe.convertedRegionPrices?.[BASE_REGION]?.price;
  if (!gross) throw new Error(`convertRegionPrices returned no ${BASE_REGION}`);
  const r = await convert((czk * czk) / amountOf(gross));
  return {
    regions: Object.values(r.convertedRegionPrices ?? {}).map(c => ({
      regionCode: c.regionCode,
      price: c.regionCode === BASE_REGION ? money('CZK', czk) : c.price,
      availability: 'AVAILABLE',
    })),
    otherRegions: r.convertedOtherRegionsPrice,
    regionsVersion: r.regionVersion?.version,
  };
}

function newTipProduct(tip, pricing) {
  const {usdPrice, eurPrice} = pricing.otherRegions ?? {};
  return {
    packageName: OPTS.packageName,
    productId: tip.productId,
    listings: playListings(tip),
    purchaseOptions: [
      {
        purchaseOptionId: TIP_OPTION,
        // Legacy-compatible so billing clients that predate Play's one-time
        // products model still sell it. Only one buy option may be.
        buyOption: {legacyCompatible: true, multiQuantityEnabled: false},
        regionalPricingAndAvailabilityConfigs: pricing.regions,
        ...(usdPrice && eurPrice
          ? {newRegionsConfig: {usdPrice, eurPrice, availability: 'AVAILABLE'}}
          : {}),
      },
    ],
  };
}

/** The same product for the legacy API, which converts prices itself. */
function legacyTipProduct(tip) {
  return {
    packageName: OPTS.packageName,
    sku: tip.productId,
    status: 'active',
    purchaseType: 'managedUser',
    defaultLanguage: 'en-US',
    defaultPrice: {priceMicros: String(tip.czk * 1e6), currency: 'CZK'},
    listings: Object.fromEntries(
      playListings(tip).map(l => [
        l.languageCode,
        {title: l.title, description: l.description},
      ]),
    ),
  };
}

async function hasOneTimeProductsApi() {
  try {
    await api('GET', '/oneTimeProducts?pageSize=1');
    return true;
  } catch (err) {
    if (err.status === 400 || err.status === 404) return false;
    throw err;
  }
}

async function getTip(id, legacy) {
  const p = legacy ? '/inappproducts/' : '/oneTimeProducts/';
  try {
    return await api('GET', p + encodeURIComponent(id));
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

function describeTip(current, legacy) {
  if (!current) return 'MISSING';
  if (legacy) return `exists, ${current.status}`;
  const options = (current.purchaseOptions ?? [])
    .map(o => `${o.purchaseOptionId} ${o.state}`)
    .join(', ');
  const languages = (current.listings ?? []).map(l => l.languageCode);
  return `exists, option ${options || 'none'}, listings ${languages.join(' ') || 'none'}`;
}

/** What `tips` has to do for one product: create, listings, activate. */
function planTip(tip, current, legacy) {
  if (!current) return legacy ? ['create'] : ['create', 'activate'];
  if (legacy) return [];
  const steps = [];
  const have = new Set((current.listings ?? []).map(l => l.languageCode));
  if (playListings(tip).some(l => !have.has(l.languageCode)))
    steps.push('listings');
  const option = current.purchaseOptions?.find(
    o => o.purchaseOptionId === TIP_OPTION,
  );
  if (option && option.state !== 'ACTIVE') steps.push('activate');
  return steps;
}

function printPlan({tip, current, steps, pricing}) {
  if (steps.includes('create')) {
    const listings = playListings(tip).map(
      l => `${l.languageCode} "${l.title}"`,
    );
    L(`  create    ${listings.join(', ')}`);
    if (pricing) {
      const byRegion = new Map(pricing.regions.map(r => [r.regionCode, r]));
      const samples = SAMPLE_REGIONS.filter(r => byRegion.has(r)).map(
        r => `${r} ${showMoney(byRegion.get(r).price)}`,
      );
      L(
        `  price     ${samples.join(', ')} (${pricing.regions.length} regions, version ${pricing.regionsVersion})`,
      );
    } else {
      L(`  price     ${tip.czk} CZK default, Play converts the rest`);
    }
  }
  if (steps.includes('listings')) {
    const have = new Set(current.listings.map(l => l.languageCode));
    const add = playListings(tip).filter(l => !have.has(l.languageCode));
    L(`  listings  add ${add.map(l => l.languageCode).join(', ')}`);
  }
  if (steps.includes('activate'))
    L(`  activate  purchase option "${TIP_OPTION}"`);
  if (!steps.length) L('  nothing to do');
}

async function applyTip({tip, current, steps, pricing}, legacy) {
  const id = encodeURIComponent(tip.productId);
  if (legacy) {
    await api(
      'POST',
      '/inappproducts?autoConvertMissingPrices=true',
      legacyTipProduct(tip),
    );
    L(`  created ${tip.productId}`);
    return;
  }
  if (steps.includes('create')) {
    // allowMissing turns the patch into a create; updateMask is required on
    // the call but ignored when it creates.
    const q = new URLSearchParams({
      allowMissing: 'true',
      updateMask: 'listings,purchaseOptions',
      'regionsVersion.version': pricing.regionsVersion,
    });
    await api(
      'PATCH',
      `/onetimeproducts/${id}?${q}`,
      newTipProduct(tip, pricing),
    );
    L(`  created   ${tip.productId}`);
  }
  if (steps.includes('listings')) {
    const have = new Set(current.listings.map(l => l.languageCode));
    const listings = [
      ...current.listings,
      ...playListings(tip).filter(l => !have.has(l.languageCode)),
    ];
    const version =
      current.regionsVersion?.version ??
      (await convertTipPrices(tip.czk)).regionsVersion;
    const q = new URLSearchParams({
      updateMask: 'listings',
      'regionsVersion.version': version,
    });
    await api('PATCH', `/onetimeproducts/${id}?${q}`, {
      packageName: OPTS.packageName,
      productId: tip.productId,
      listings,
    });
    L(`  listings  ${tip.productId}`);
  }
  if (steps.includes('activate')) {
    await api(
      'POST',
      `/oneTimeProducts/${id}/purchaseOptions:batchUpdateStates`,
      {
        requests: [
          {
            activatePurchaseOptionRequest: {
              packageName: OPTS.packageName,
              productId: tip.productId,
              purchaseOptionId: TIP_OPTION,
            },
          },
        ],
      },
    );
    L(`  activated ${tip.productId} (${TIP_OPTION})`);
  }
}

async function cmdTips() {
  const tips = tipDefinitions();
  const legacy = !(await hasOneTimeProductsApi());
  L(
    `Tip jar on ${OPTS.packageName}, via the ${legacy ? 'legacy in-app products' : 'one-time products'} API`,
  );
  const plans = [];
  for (const tip of tips) {
    const current = await getTip(tip.productId, legacy);
    const steps = planTip(tip, current, legacy);
    const pricing =
      steps.includes('create') && !legacy
        ? await convertTipPrices(tip.czk)
        : null;
    const plan = {tip, current, steps, pricing};
    plans.push(plan);
    L();
    L(`${tip.productId}  ${describeTip(current, legacy)}`);
    printPlan(plan);
  }

  const todo = plans.filter(p => p.steps.length);
  L();
  if (!todo.length) {
    L('Nothing to do.');
    return;
  }
  if (!OPTS.yes) {
    L('DRY RUN. Pass --yes to write to Google Play.');
    return;
  }
  for (const plan of todo) {
    await applyTip(plan, legacy);
  }
  L();
  L('Now');
  for (const tip of tips) {
    const now = await getTip(tip.productId, legacy);
    L(`  ${tip.productId.padEnd(28)} ${describeTip(now, legacy)}`);
  }
}

// ---- main -----------------------------------------------------------------
// command -> [offline check of arguments and local files, run]
const COMMANDS = {
  status: [() => undefined, cmdStatus],
  promote: [promoteArgs, cmdPromote],
  listing: [
    () => pushArgs({text: true, images: argv.includes('--screenshots')}),
    cmdPush,
  ],
  screenshots: [() => pushArgs({text: false, images: true}), cmdPush],
  tips: [() => undefined, cmdTips],
};

(async () => {
  if (OPTS.help || !cmd) return usage();
  if (!COMMANDS[cmd]) {
    usage();
    process.exitCode = 1;
    return;
  }
  const [prepare, run] = COMMANDS[cmd];
  const args = await prepare();
  const k = await loadKey();
  TOKEN = await getAccessToken(k);
  L(`Signed in as ${k.client_email}`);
  await run(args);
})().catch(e => {
  console.error('ERROR', e.message);
  if (e.status === 401 || e.status === 403)
    console.error(
      'The service account lacks a Play Console permission for this call. ' +
        'See "Google Play setup" in contributingGuides/TIP_JAR.md.',
    );
  process.exit(1);
});
