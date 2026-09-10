#!/usr/bin/env node
/**
 * Kiroku Google Play Console helper (zero-dependency, read-only).
 *
 * The Play-side counterpart of scripts/asc.mjs: it reads what Play actually
 * has, so release questions ("what's on open testing?", "is the listing
 * complete?") get answered from the console instead of guessed. It reuses the
 * fastlane service account (android/app/android-fastlane-json-key.json) and
 * mints the RS256 JWT with Node's built-in crypto. It NEVER prints the key.
 *
 * Tracks and listings can only be read inside an edit, Play's transaction
 * around every app change. `status` opens one, reads from it, and deletes it.
 * It never commits, so nothing in the console changes, and an open edit does
 * not disturb other ones (a CI upload running at the same time is unaffected).
 *
 * Requires Node 18+ (global fetch), plus gpg when the key is only present
 * encrypted. No npm dependencies.
 *
 * Usage:
 *   node scripts/play.mjs status
 *
 * Commands:
 *   status   Tracks and their releases (version codes decoded to the internal
 *            version, status, rollout, release-note lengths), the store
 *            listing per language (text lengths against Play's limits, icon /
 *            feature graphic / screenshot counts), the tip-jar products
 *            against CONST.TIPS.PRODUCT_IDS, and subscriptions. Ends with the
 *            gaps it found and the Play Console items the API cannot read.
 *            Writes nothing.
 *
 * Key: --key <path>, else $PLAY_KEY_JSON, else
 * android/app/android-fastlane-json-key.json. When only the .gpg copy exists
 * (the normal state of a checkout), it is decrypted in memory using
 * $LARGE_SECRET_PASSPHRASE, or a hidden prompt for it when that is unset. The
 * plaintext key is never written to disk.
 *
 * Flags:
 *   --package <id>   Play package name (default: com.alcohol_tracker)
 *   --key <path>     service account JSON key (see Key above)
 *   --help, -h       show this help
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE =
  'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
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
};

function usage() {
  L(
    fs
      .readFileSync(fileURLToPath(import.meta.url), 'utf8')
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
async function api(method, p) {
  const url = `${BASE}/${encodeURIComponent(OPTS.packageName)}${p}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    // Google answers a bodiless POST with 411 Length Required.
    body: method === 'POST' ? '{}' : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {raw: text};
  }
  if (!res.ok) {
    const err = new Error(
      `HTTP ${res.status} ${method} ${p}: ${parsed.error?.message ?? text}`,
    );
    err.status = res.status;
    throw err;
  }
  return parsed;
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
function printTracks(tracks, versionCode, gaps) {
  L('Tracks');
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
      // eslint-disable-next-line no-await-in-loop
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

// ---- main -----------------------------------------------------------------
(async () => {
  if (OPTS.help || !cmd) return usage();
  if (cmd !== 'status') {
    usage();
    process.exitCode = 1;
    return;
  }
  const k = await loadKey();
  TOKEN = await getAccessToken(k);
  L(`Signed in as ${k.client_email}`);
  await cmdStatus();
})().catch(e => {
  console.error('ERROR', e.message);
  process.exit(1);
});
