#!/usr/bin/env node
/**
 * Kiroku — App Store Connect helper (zero-dependency).
 *
 * A lightweight CLI over the App Store Connect API for the operations we reach
 * for around a release: inspect state, lint the store listing, and submit a
 * version for review. It reuses the existing fastlane API key
 * (ios/ios-fastlane-json-key.json — bundles key_id / issuer_id / the .p8) and
 * mints the ES256 JWT with Node's built-in crypto. It NEVER prints the key.
 *
 * Requires Node 18+ (global fetch). No npm dependencies.
 *
 * Usage:
 *   node scripts/asc.mjs status
 *   node scripts/asc.mjs scrub  [--version 0.3.14] [--terms supporter,subscription]
 *   node scripts/asc.mjs submit [--version 0.3.14] [--yes]
 *
 * Commands:
 *   status   App, versions + states, the editable version's build,
 *            subscription states, and review submissions + their items.
 *   scrub    Lint the version's store-listing text (description / keywords /
 *            promo / what's-new) for forbidden terms. Exit 1 on any hit — usable
 *            as a pre-submit / CI gate. Default terms = paid-tier words.
 *   submit   Pre-flight (version submittable, build VALID, subs parked, listing
 *            clean) then submit the version for review, app-only (no IAPs).
 *            DRY RUN unless --yes is passed (submit is irreversible).
 *
 * Flags:
 *   --version <str>    target version (default: the lone PREPARE_FOR_SUBMISSION one)
 *   --bundle-id <id>   app bundle id (default: org.reactjs.native.example.alcohol-tracker)
 *   --app-id <id>      ASC app id (skips the bundle-id lookup)
 *   --key <path>       ASC API key JSON (default: <repo>/ios/ios-fastlane-json-key.json)
 *   --terms <csv>      scrub: comma-separated forbidden terms
 *   --platform <p>     default IOS
 *   --yes              submit: actually execute (otherwise dry run)
 *   --help, -h         show this help
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://api.appstoreconnect.apple.com';
const DEFAULT_BUNDLE_ID = 'org.reactjs.native.example.alcohol-tracker';
const DEFAULT_TERMS = [
  'supporter',
  'subscription',
  'subscribe',
  'podporovatel',
  'předplatn',
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
  version: flag('version'),
  bundleId: flag('bundle-id', process.env.ASC_BUNDLE_ID || DEFAULT_BUNDLE_ID),
  appId: flag('app-id', process.env.ASC_APP_ID),
  keyPath: flag(
    'key',
    process.env.ASC_KEY_JSON ||
      path.join(ROOT, 'ios', 'ios-fastlane-json-key.json'),
  ),
  platform: flag('platform', 'IOS'),
  terms: flag('terms'),
  yes: argv.includes('--yes'),
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

// ---- auth (ES256 JWT, no deps) -------------------------------------------
const b64url = input =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
function mintToken(k) {
  const header = b64url(
    JSON.stringify({alg: 'ES256', kid: k.key_id, typ: 'JWT'}),
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      iss: k.issuer_id,
      iat: now,
      exp: now + 1200,
      aud: 'appstoreconnect-v1',
    }),
  );
  const signer = crypto.createSign('SHA256');
  signer.update(`${header}.${payload}`);
  const sig = signer.sign({key: k.key, dsaEncoding: 'ieee-p1363'});
  return `${header}.${payload}.${b64url(sig)}`;
}

let TOKEN;
async function api(method, p, body) {
  const url = p.startsWith('http') ? p : BASE + p;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {raw: text};
  }
  if (!res.ok)
    throw new Error(
      `HTTP ${res.status} ${method} ${url}\n${JSON.stringify(parsed, null, 2)}`,
    );
  return parsed;
}

// ---- helpers --------------------------------------------------------------
const versState = v =>
  v.attributes.appStoreState || v.attributes.appVersionState || '?';
async function resolveAppId() {
  if (OPTS.appId) return OPTS.appId;
  const r = await api(
    'GET',
    `/v1/apps?filter[bundleId]=${encodeURIComponent(OPTS.bundleId)}&limit=1`,
  );
  if (!r.data.length)
    throw new Error(`No app found for bundleId ${OPTS.bundleId}`);
  return r.data[0].id;
}
async function listVersions(appId) {
  const r = await api(
    'GET',
    `/v1/apps/${appId}/appStoreVersions?filter[platform]=${OPTS.platform}&limit=50`,
  );
  return r.data;
}
async function pickVersion(appId) {
  const vs = await listVersions(appId);
  if (OPTS.version) {
    const v = vs.find(x => x.attributes.versionString === OPTS.version);
    if (!v) throw new Error(`Version ${OPTS.version} not found`);
    return v;
  }
  const editable = vs.filter(x => versState(x) === 'PREPARE_FOR_SUBMISSION');
  if (editable.length === 1) return editable[0];
  throw new Error(
    `Specify --version (candidates: ${vs.map(x => `${x.attributes.versionString}[${versState(x)}]`).join(', ')})`,
  );
}
const termList = () =>
  OPTS.terms
    ? String(OPTS.terms)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : DEFAULT_TERMS;
const scrubRegex = () =>
  new RegExp(
    termList()
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|'),
    'i',
  );
async function scanListing(versionId) {
  const re = scrubRegex();
  const locs = await api(
    'GET',
    `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50`,
  );
  const hits = [];
  for (const loc of locs.data) {
    for (const f of [
      'description',
      'keywords',
      'promotionalText',
      'whatsNew',
    ]) {
      const m = (loc.attributes[f] || '').match(re);
      if (m) hits.push({locale: loc.attributes.locale, field: f, term: m[0]});
    }
  }
  return hits;
}

// ---- commands -------------------------------------------------------------
async function cmdStatus(appId) {
  const app = await api('GET', `/v1/apps/${appId}`);
  L(
    `APP: ${app.data.attributes.name} (${app.data.attributes.bundleId}) id=${appId}`,
  );

  const vs = await listVersions(appId);
  L('\nVERSIONS:');
  vs.forEach(v =>
    L(`  ${v.attributes.versionString} [${versState(v)}] id=${v.id}`),
  );

  const editable =
    vs.find(x => versState(x) === 'PREPARE_FOR_SUBMISSION') || vs[0];
  if (editable) {
    const b = await api(
      'GET',
      `/v1/appStoreVersions/${editable.id}/build`,
    ).catch(() => null);
    const a = b && b.data && b.data.attributes;
    L(
      `\nBUILD (${editable.attributes.versionString}): ${a ? `${a.version} processing=${a.processingState}` : 'none attached'}`,
    );
  }

  L('\nSUBSCRIPTIONS:');
  const groups = await api(
    'GET',
    `/v1/apps/${appId}/subscriptionGroups?limit=20`,
  );
  for (const g of groups.data) {
    L(`  Group: ${g.attributes.referenceName}`);
    const subs = await api(
      'GET',
      `/v1/subscriptionGroups/${g.id}/subscriptions?limit=50`,
    );
    subs.data.forEach(s =>
      L(
        `    - ${s.attributes.name} (${s.attributes.productId}) state=${s.attributes.state}`,
      ),
    );
  }

  L('\nREVIEW SUBMISSIONS:');
  const subm = await api(
    'GET',
    `/v1/reviewSubmissions?filter[app]=${appId}&filter[platform]=${OPTS.platform}&limit=20`,
  );
  if (!subm.data.length) L('  (none)');
  for (const rs of subm.data) {
    L(
      `  ${rs.id} state=${rs.attributes.state} submittedDate=${rs.attributes.submittedDate || '-'}`,
    );
    const items = await api(
      'GET',
      `/v1/reviewSubmissions/${rs.id}/items?include=appStoreVersion&limit=50`,
    ).catch(() => null);
    if (!items) continue;
    const inc = {};
    (items.included || []).forEach(i => (inc[`${i.type}:${i.id}`] = i));
    for (const it of items.data) {
      const av = it.relationships?.appStoreVersion?.data;
      const vstr =
        av && inc[`appStoreVersions:${av.id}`]
          ? ` v=${inc[`appStoreVersions:${av.id}`].attributes.versionString}`
          : '';
      L(`     item ${it.attributes?.state || ''}${vstr}`);
    }
  }
}

async function cmdScrub(appId) {
  const v = await pickVersion(appId);
  L(`Scrubbing ${v.attributes.versionString} for: ${termList().join(', ')}`);
  const hits = await scanListing(v.id);
  if (!hits.length) {
    L('clean ✓');
    return 0;
  }
  hits.forEach(h => L(`  ⚠ ${h.locale} ${h.field}: "${h.term}"`));
  L(`${hits.length} hit(s).`);
  return 1;
}

async function cmdSubmit(appId) {
  const v = await pickVersion(appId);
  const st = versState(v);
  L(`Version ${v.attributes.versionString}: ${st} id=${v.id}`);

  const b = await api('GET', `/v1/appStoreVersions/${v.id}/build`).catch(
    () => null,
  );
  const build = b && b.data && b.data.attributes;
  L(
    `Build: ${build ? `${build.version} processing=${build.processingState}` : 'NONE'}`,
  );

  const problems = [];
  if (st !== 'PREPARE_FOR_SUBMISSION')
    problems.push(`version state is ${st}, expected PREPARE_FOR_SUBMISSION`);
  if (!build) problems.push('no build attached');
  else if (build.processingState !== 'VALID')
    problems.push(`build processing=${build.processingState}`);

  const hits = await scanListing(v.id);
  if (hits.length) {
    L('Listing scrub:');
    hits.forEach(h => L(`  ⚠ ${h.locale} ${h.field}: "${h.term}"`));
    problems.push(`${hits.length} forbidden listing mention(s)`);
  } else {
    L('Listing scrub: clean ✓');
  }

  const groups = await api(
    'GET',
    `/v1/apps/${appId}/subscriptionGroups?limit=20`,
  );
  for (const g of groups.data) {
    const subs = await api(
      'GET',
      `/v1/subscriptionGroups/${g.id}/subscriptions?limit=50`,
    );
    for (const s of subs.data) {
      const inReview = [
        'WAITING_FOR_REVIEW',
        'IN_REVIEW',
        'PENDING_BINARY_APPROVAL',
      ].includes(s.attributes.state);
      L(
        `Subscription ${s.attributes.productId}: ${s.attributes.state}${inReview ? ' (⚠ in review)' : ' (parked)'}`,
      );
      if (inReview)
        problems.push(`subscription ${s.attributes.productId} is in review`);
    }
  }

  L(
    '\nPlan: POST reviewSubmissions → POST reviewSubmissionItems(appStoreVersion) → PATCH submitted=true',
  );
  if (problems.length) {
    L(`\nBLOCKED:\n${problems.map(p => `  - ${p}`).join('\n')}`);
    process.exitCode = 1;
    return;
  }
  if (!OPTS.yes) {
    L('\nDRY RUN — pass --yes to submit (irreversible).');
    L('Reminder: confirm the App Privacy / ATT label manually in ASC first.');
    return;
  }

  L('\nSubmitting…');
  const sub = await api('POST', '/v1/reviewSubmissions', {
    data: {
      type: 'reviewSubmissions',
      attributes: {platform: OPTS.platform},
      relationships: {app: {data: {type: 'apps', id: appId}}},
    },
  });
  const id = sub.data.id;
  await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: {data: {type: 'reviewSubmissions', id}},
        appStoreVersion: {data: {type: 'appStoreVersions', id: v.id}},
      },
    },
  });
  const done = await api('PATCH', `/v1/reviewSubmissions/${id}`, {
    data: {type: 'reviewSubmissions', id, attributes: {submitted: true}},
  });
  L(`Submitted ✓  submission=${id}  state=${done.data.attributes.state}`);
}

// ---- main -----------------------------------------------------------------
(async () => {
  if (OPTS.help || !cmd) return usage();
  const k = JSON.parse(fs.readFileSync(OPTS.keyPath, 'utf8'));
  if (!k.key_id || !k.issuer_id || !k.key)
    throw new Error(`Key JSON missing key_id/issuer_id/key: ${OPTS.keyPath}`);
  TOKEN = mintToken(k);
  const appId = await resolveAppId();

  if (cmd === 'status') return cmdStatus(appId);
  if (cmd === 'scrub') {
    process.exitCode = await cmdScrub(appId);
    return;
  }
  if (cmd === 'submit') return cmdSubmit(appId);
  usage();
  process.exitCode = 1;
})().catch(e => {
  console.error('ERROR', e.message);
  process.exit(1);
});
