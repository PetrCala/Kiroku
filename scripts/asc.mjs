#!/usr/bin/env node
/**
 * Kiroku App Store Connect helper (zero-dependency).
 *
 * A lightweight CLI over the App Store Connect API for the operations we reach
 * for around a release: inspect state, lint the store listing, and submit a
 * version for review. It reuses the existing fastlane API key
 * (ios/ios-fastlane-json-key.json, bundles key_id / issuer_id / the .p8) and
 * mints the ES256 JWT with Node's built-in crypto. It NEVER prints the key.
 *
 * Requires Node 18+ (global fetch). No npm dependencies.
 *
 * Usage:
 *   node scripts/asc.mjs status
 *   node scripts/asc.mjs preflight --app-id 6670502234
 *   node scripts/asc.mjs scrub  [--version 0.3.14] [--terms supporter,subscription]
 *   node scripts/asc.mjs shots  --dir <folder> [--locale en-US] [--replace] [--yes]
 *   node scripts/asc.mjs submit [--version 0.3.14] [--iaps a,b,c] [--yes]
 *   node scripts/asc.mjs rename --version 0.3.14 --to 0.3.15 [--yes]
 *   node scripts/asc.mjs clone-listing --from <appId> --to <appId> [--yes]
 *
 * Commands:
 *   status   App, versions + states, the editable version's build,
 *            subscription states, and review submissions + their items.
 *   preflight
 *            Read-only report of every precondition for submitting this
 *            record: version state and version string vs the repo's
 *            Info.plist, the attached build, export compliance, content
 *            rights, the age rating declaration, review detail and demo
 *            account, screenshots for every required display type (incl. the
 *            Apple Watch slot the embedded watch app forces), the tip-jar
 *            products, a colliding review submission, and the `scrub` listing
 *            check. One PASS/FAIL line each; exit 1 on any failure, so it
 *            works as a gate. Writes nothing.
 *   scrub    Lint the version's store-listing text (description / keywords /
 *            promo / what's-new) for forbidden terms. Exit 1 on any hit, usable
 *            as a pre-submit / CI gate. Default terms = paid-tier words.
 *   shots    Upload App Store screenshots for one locale from a folder of PNGs,
 *            in filename order. The display type comes from each PNG's own
 *            pixel size, so the framing pipeline's exact-size output decides
 *            which slot it lands in. DRY RUN unless --yes.
 *   submit   Pre-flight (version submittable, build VALID, subs parked, listing
 *            clean) then submit the version for review. Pass --iaps to also
 *            attach in-app purchases (required for the FIRST IAP submission,
 *            which must ride an app version). DRY RUN unless --yes is passed
 *            (submit is irreversible).
 *   rename   PATCH an appStoreVersion's versionString (e.g. after a rejection,
 *            to reopen it for editing, or to reconcile a fresh record's 1.0
 *            down to what the app actually builds). Requires --to. DRY RUN
 *            unless --yes.
 *   clone-listing
 *            Copy the store listing from one app record onto another: app info
 *            localizations (subtitle / privacy policy), version localizations
 *            (description / keywords / promo / what's new / URLs), categories,
 *            contentRightsDeclaration, the age rating declaration, and the
 *            review detail incl. the demo account. Requires --from and --to
 *            (both ASC app ids). DRY RUN unless --yes. The app name,
 *            screenshots and the App Privacy labels are NOT copied; the report
 *            says what is left to do by hand, read off both records live.
 *
 * Flags:
 *   --version <str>    target version (default: the lone PREPARE_FOR_SUBMISSION one)
 *   --to <str>         rename: the new version string
 *                      clone-listing: the DESTINATION ASC app id
 *   --from <id>        clone-listing: the SOURCE ASC app id
 *   --from-version <s> clone-listing: source version (default: newest)
 *   --to-version <s>   clone-listing: destination version (default: the lone
 *                      PREPARE_FOR_SUBMISSION one)
 *   --bundle-id <id>   app bundle id (default: com.kiroku.app)
 *   --app-id <id>      ASC app id (skips the bundle-id lookup)
 *   --key <path>       ASC API key JSON (default: <repo>/ios/ios-fastlane-json-key.json)
 *   --terms <csv>      scrub: comma-separated forbidden terms
 *   --iaps <csv>       submit: product ids of in-app purchases to attach to the
 *                      review submission (each must be READY_TO_SUBMIT)
 *   --dir <path>       shots: folder of PNGs for one locale (sorted by filename)
 *   --locale <code>    shots: ASC locale to write (default en-US)
 *   --replace          shots: delete the existing screenshots in each touched set
 *   --platform <p>     default IOS
 *   --yes              actually execute (otherwise dry run)
 *   --help, -h         show this help
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://api.appstoreconnect.apple.com';
const DEFAULT_BUNDLE_ID = 'com.kiroku.app';
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
  dir: flag('dir'),
  locale: flag('locale', 'en-US'),
  replace: argv.includes('--replace'),
  to: flag('to'),
  from: flag('from'),
  fromVersion: flag('from-version'),
  toVersion: flag('to-version'),
  bundleId: flag('bundle-id', process.env.ASC_BUNDLE_ID || DEFAULT_BUNDLE_ID),
  appId: flag('app-id', process.env.ASC_APP_ID),
  keyPath: flag(
    'key',
    process.env.ASC_KEY_JSON ||
      path.join(ROOT, 'ios', 'ios-fastlane-json-key.json'),
  ),
  platform: flag('platform', 'IOS'),
  terms: flag('terms'),
  iaps: flag('iaps'),
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
// Version states that still take edits and a (re)submission. DEVELOPER_REJECTED
// is a version we pulled from review ourselves, and behaves exactly like
// PREPARE_FOR_SUBMISSION.
const EDITABLE_VERSION_STATES = [
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
];
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

/** The build attached to a version, or null when none is. */
async function fetchBuild(versionId) {
  const r = await api('GET', `/v1/appStoreVersions/${versionId}/build`).catch(
    () => null,
  );
  return r?.data ?? null;
}

/** Every in-app purchase on the record, keyed by product id. */
async function iapsByProductId(appId) {
  const r = await api('GET', `/v1/apps/${appId}/inAppPurchasesV2?limit=200`);
  return new Map(r.data.map(i => [i.attributes.productId, i]));
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
    const b = await fetchBuild(editable.id);
    const a = b && b.attributes;
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

// ---- screenshots ----------------------------------------------------------

// ASC picks the slot from the pixel size, and the sizes are exact: an image one
// pixel off is rejected outright. These are the sizes the framing pipeline
// emits (scripts/store-screenshots.config.mjs `devices`). Note APP_IPHONE_67 is
// the current largest-iPhone slot and takes 1320x2868 as well as 1290x2796,
// which is why the live listing shows 1320x2868 images filed under _67.
//
// A version may carry only ONE Apple Watch display type. Creating a second set
// alongside an existing one fails with HTTP 409
// STATE_ERROR.MULTIPLE_APPLE_WATCH_SCREENSHOT_TYPES_NOT_ALLOWED_IN_VERSION, so
// upload exactly one watch size and let Apple scale it. Use the 368x448
// SERIES_4 shot: that is the slot ASC demands before it will accept a
// submission whose build embeds the watch app. The framing pipeline still
// emits all three sizes, so drop the 396 and 410 files from the upload folder
// rather than feeding the whole framed tree to `shots`.
const DISPLAY_TYPES = {
  '1320x2868': 'APP_IPHONE_67',
  '1290x2796': 'APP_IPHONE_67',
  '2064x2752': 'APP_IPAD_PRO_3GEN_129',
  '368x448': 'APP_WATCH_SERIES_4',
  '396x484': 'APP_WATCH_SERIES_7',
  '410x502': 'APP_WATCH_ULTRA',
};

/** Width/height straight out of the PNG IHDR chunk, so no image dependency. */
function pngSize(buf) {
  const isPng =
    buf.length > 24 &&
    buf.readUInt32BE(0) === 0x89504e47 &&
    buf.readUInt32BE(12) === 0x49484452;
  if (!isPng) throw new Error('not a PNG');
  return {width: buf.readUInt32BE(16), height: buf.readUInt32BE(20)};
}

/** Runs one of the `uploadOperations` ASC hands back with the reservation. */
async function runUploadOperation(op, buf) {
  const headers = {};
  for (const h of op.requestHeaders ?? []) headers[h.name] = h.value;
  const res = await fetch(op.url, {
    method: op.method,
    headers,
    body: buf.subarray(op.offset, op.offset + op.length),
  });
  if (!res.ok)
    throw new Error(
      `upload part failed: HTTP ${res.status} ${op.method} ${op.url}`,
    );
}

async function localizationFor(versionId, locale) {
  const locs = await api(
    'GET',
    `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`,
  );
  const loc = locs.data.find(l => l.attributes.locale === locale);
  if (!loc)
    throw new Error(
      `locale ${locale} not on this version (have: ${locs.data
        .map(l => l.attributes.locale)
        .join(', ')})`,
    );
  return loc;
}

async function cmdShots(appId) {
  if (typeof OPTS.dir !== 'string')
    throw new Error('shots: --dir <folder of PNGs> is required');
  const dir = path.isAbsolute(OPTS.dir)
    ? OPTS.dir
    : path.join(process.cwd(), OPTS.dir);

  const files = fs
    .readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.png'))
    .sort();
  if (!files.length) throw new Error(`no PNGs in ${dir}`);

  const v = await pickVersion(appId);
  L(`Version ${v.attributes.versionString}: ${versState(v)} id=${v.id}`);
  const loc = await localizationFor(v.id, OPTS.locale);
  L(`Locale ${OPTS.locale} localization=${loc.id}`);

  // Group the files by the slot their pixel size maps to; each slot is one set.
  const planned = new Map();
  for (const file of files) {
    const buf = fs.readFileSync(path.join(dir, file));
    const {width, height} = pngSize(buf);
    const type = DISPLAY_TYPES[`${width}x${height}`];
    if (!type)
      throw new Error(
        `${file} is ${width}x${height}, which is not an App Store size. ` +
          `Known: ${Object.keys(DISPLAY_TYPES).join(', ')}`,
      );
    if (!planned.has(type)) planned.set(type, []);
    planned.get(type).push({file, buf, width, height});
  }

  const sets = await api(
    'GET',
    `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`,
  );

  L('');
  for (const [type, entries] of planned) {
    const existing = sets.data.find(
      s => s.attributes.screenshotDisplayType === type,
    );
    const current = existing
      ? await api('GET', `/v1/appScreenshotSets/${existing.id}/appScreenshots`)
      : {data: []};
    L(
      `${type}: ${current.data.length} live, uploading ${entries.length}` +
        `${OPTS.replace ? ' (replacing)' : ' (appending)'}`,
    );
    entries.forEach((e, i) =>
      L(
        `   ${String(i + 1).padStart(2, '0')} ${e.file}  ${e.width}x${e.height}`,
      ),
    );
  }

  if (!OPTS.yes) {
    L('\nDRY RUN. Pass --yes to write to App Store Connect.');
    return;
  }

  for (const [type, entries] of planned) {
    let set = sets.data.find(s => s.attributes.screenshotDisplayType === type);
    if (!set) {
      L(`\nCreating ${type} set`);
      const created = await api('POST', '/v1/appScreenshotSets', {
        data: {
          type: 'appScreenshotSets',
          attributes: {screenshotDisplayType: type},
          relationships: {
            appStoreVersionLocalization: {
              data: {type: 'appStoreVersionLocalizations', id: loc.id},
            },
          },
        },
      });
      set = created.data;
    }

    if (OPTS.replace) {
      const current = await api(
        'GET',
        `/v1/appScreenshotSets/${set.id}/appScreenshots`,
      );
      for (const s of current.data) {
        await api('DELETE', `/v1/appScreenshots/${s.id}`);
        L(`  deleted ${s.attributes.fileName}`);
      }
    }

    const uploadedIds = [];
    for (const {file, buf} of entries) {
      const reserved = await api('POST', '/v1/appScreenshots', {
        data: {
          type: 'appScreenshots',
          attributes: {fileName: file, fileSize: buf.length},
          relationships: {
            appScreenshotSet: {data: {type: 'appScreenshotSets', id: set.id}},
          },
        },
      });
      const id = reserved.data.id;
      for (const op of reserved.data.attributes.uploadOperations ?? []) {
        await runUploadOperation(op, buf);
      }
      const checksum = crypto.createHash('md5').update(buf).digest('hex');
      await api('PATCH', `/v1/appScreenshots/${id}`, {
        data: {
          type: 'appScreenshots',
          id,
          attributes: {uploaded: true, sourceFileChecksum: checksum},
        },
      });
      uploadedIds.push(id);
      L(`  uploaded ${file}`);
    }

    // Store order follows this list, not upload order, so pin it explicitly.
    await api(
      'PATCH',
      `/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`,
      {
        data: uploadedIds.map(id => ({type: 'appScreenshots', id})),
      },
    );
    L(`  ${type} ordered (${uploadedIds.length})`);
  }

  L('\nDone. Apple processes each asset asynchronously; re-run `status` or');
  L('check ASC until every screenshot reports assetDeliveryState COMPLETE.');
}

async function cmdSubmit(appId) {
  const v = await pickVersion(appId);
  const st = versState(v);
  L(`Version ${v.attributes.versionString}: ${st} id=${v.id}`);

  const b = await fetchBuild(v.id);
  const build = b && b.attributes;
  L(
    `Build: ${build ? `${build.version} processing=${build.processingState}` : 'NONE'}`,
  );

  const problems = [];
  // DEVELOPER_REJECTED (a version pulled from review by us) is editable and
  // resubmittable, same as PREPARE_FOR_SUBMISSION.
  if (!EDITABLE_VERSION_STATES.includes(st))
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

  // Resolve --iaps product ids to their editable inAppPurchaseVersion ids.
  // IAPs join a review submission as inAppPurchaseVersion items (NOT the IAP
  // itself; posting an inAppPurchaseV2 relationship is a 409). Apple requires
  // the FIRST IAP to be submitted together with an app version.
  const iapItems = [];
  if (OPTS.iaps) {
    const wanted = String(OPTS.iaps)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const all = await iapsByProductId(appId);
    for (const productId of wanted) {
      const iap = all.get(productId);
      if (!iap) {
        problems.push(`IAP ${productId} not found`);
        continue;
      }
      // Two state machines: the IAP's own state says whether metadata is
      // complete (READY_TO_SUBMIT vs MISSING_METADATA), while its version
      // resource has app-version-like states and no READY_TO_SUBMIT at all.
      // The attachable version is the editable one.
      if (iap.attributes.state !== 'READY_TO_SUBMIT') {
        L(`IAP ${productId}: ${iap.attributes.state}`);
        problems.push(
          `IAP ${productId} is ${iap.attributes.state}, expected READY_TO_SUBMIT`,
        );
        continue;
      }
      const vers = await api(
        'GET',
        `/v2/inAppPurchases/${iap.id}/versions?limit=10`,
      );
      const editableStates = [
        'PREPARE_FOR_SUBMISSION',
        'DEVELOPER_REJECTED',
        'REJECTED',
      ];
      const ready = vers.data.find(x =>
        editableStates.includes(x.attributes.state),
      );
      L(
        `IAP ${productId}: ${iap.attributes.state}${ready ? ` (version ${ready.attributes.state})` : ' (no editable version)'}`,
      );
      if (!ready) {
        problems.push(
          `IAP ${productId} has no editable version (states: ${vers.data.map(x => x.attributes.state).join(', ') || 'none'})`,
        );
        continue;
      }
      iapItems.push({productId, versionId: ready.id});
    }
  }

  L(
    `\nPlan: POST reviewSubmissions → POST reviewSubmissionItems(appStoreVersion${iapItems.length ? ` + ${iapItems.length} inAppPurchaseVersion` : ''}) → PATCH submitted=true`,
  );
  if (problems.length) {
    L(`\nBLOCKED:\n${problems.map(p => `  - ${p}`).join('\n')}`);
    process.exitCode = 1;
    return;
  }
  if (!OPTS.yes) {
    L('\nDRY RUN. Pass --yes to submit (irreversible).');
    L('Reminder: confirm the App Privacy / ATT label manually in ASC first.');
    return;
  }

  L('\nSubmitting…');
  // ASC allows only one open (unsubmitted) submission per platform, and
  // leftovers from aborted attempts linger in READY_FOR_REVIEW. Reuse one if
  // present instead of failing on the POST.
  const existing = await api(
    'GET',
    `/v1/reviewSubmissions?filter[app]=${appId}&filter[platform]=${OPTS.platform}&filter[state]=READY_FOR_REVIEW&limit=5`,
  );
  let id;
  if (existing.data.length) {
    id = existing.data[0].id;
    L(`Reusing open submission ${id}`);
    const items = await api(
      'GET',
      `/v1/reviewSubmissions/${id}/items?limit=50`,
    );
    for (const it of items.data) {
      await api('DELETE', `/v1/reviewSubmissionItems/${it.id}`);
    }
  } else {
    const sub = await api('POST', '/v1/reviewSubmissions', {
      data: {
        type: 'reviewSubmissions',
        attributes: {platform: OPTS.platform},
        relationships: {app: {data: {type: 'apps', id: appId}}},
      },
    });
    id = sub.data.id;
  }
  await api('POST', '/v1/reviewSubmissionItems', {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: {data: {type: 'reviewSubmissions', id}},
        appStoreVersion: {data: {type: 'appStoreVersions', id: v.id}},
      },
    },
  });
  for (const item of iapItems) {
    await api('POST', '/v1/reviewSubmissionItems', {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: {data: {type: 'reviewSubmissions', id}},
          inAppPurchaseVersion: {
            data: {type: 'inAppPurchaseVersions', id: item.versionId},
          },
        },
      },
    });
    L(`  attached IAP ${item.productId}`);
  }
  const done = await api('PATCH', `/v1/reviewSubmissions/${id}`, {
    data: {type: 'reviewSubmissions', id, attributes: {submitted: true}},
  });
  L(`Submitted ✓  submission=${id}  state=${done.data.attributes.state}`);
}

// ---- clone-listing --------------------------------------------------------

/**
 * The App Store Connect API does not expose the App Privacy questionnaire (the
 * data-collection "nutrition labels") at all: there is no appDataUsages
 * resource, and neither /v1/apps/{id}/appDataUsages nor
 * /v1/apps/{id}/appPrivacyDetails exists (both 404 with PATH_ERROR). Same for
 * pricing/availability territories in any usefully copyable form. Anything in
 * this list is reported as manual rather than attempted.
 */
const CLONE_MANUAL = [
  [
    'Screenshots & app previews',
    'not reimplemented here. Regenerate with `npm run frame-screenshots` and upload with\n' +
      '     `node scripts/asc.mjs shots --dir <folder> --locale <loc> --replace --yes`\n' +
      '     (one run per locale). See contributingGuides/SCREENSHOTS.md.\n' +
      '     The build embeds a watch app, so the APP_WATCH_SERIES_4 slot (368x448) is a\n' +
      '     submission prerequisite on the new record, not an optional extra.',
  ],
  [
    'App Privacy (nutrition labels)',
    'the API does not expose it: /v1/appDataUsages and appPrivacyDetails both 404.\n' +
      '     Re-answer it by hand in ASC > App Privacy, matching the old record question for question.',
  ],
  [
    'Pricing & availability',
    'price tier, territories and pre-orders are not copied. Set them in ASC > Pricing and Availability.',
  ],
  [
    'In-app purchases',
    'product ids cannot be reused across records. See section 5 of BUNDLE_ID_MIGRATION.md.',
  ],
  [
    'Build & TestFlight',
    'a build reaches a record by being uploaded against its bundle id; nothing to copy.\n' +
      '     A new record also starts with no TestFlight groups and no testers, so the "Beta"\n' +
      '     group fastlane/Fastfile distributes to must be recreated and testers re-invited.',
  ],
];

/** Age rating fields the API accepts on an update. Anything else is derived. */
const AGE_RATING_FIELDS = [
  'advertising',
  'ageAssurance',
  'ageRatingOverride',
  'ageRatingOverrideV2',
  'alcoholTobaccoOrDrugUseOrReferences',
  'contests',
  'developerAgeRatingInfoUrl',
  'gambling',
  'gamblingSimulated',
  'gunsOrOtherWeapons',
  'healthOrWellnessTopics',
  'horrorOrFearThemes',
  'kidsAgeBand',
  'koreaAgeRatingOverride',
  'lootBox',
  'matureOrSuggestiveThemes',
  'medicalOrTreatmentInformation',
  'messagingAndChat',
  'parentalControls',
  'profanityOrCrudeHumor',
  'sexualContentGraphicAndNudity',
  'sexualContentOrNudity',
  'socialMedia',
  'socialMediaAgeRestricted',
  'unrestrictedWebAccess',
  'userGeneratedContent',
  'violenceCartoonOrFantasy',
  'violenceRealistic',
  'violenceRealisticProlongedGraphicOrSadistic',
];
/**
 * Age rating fields where null is a real answer rather than an unanswered
 * question: kidsAgeBand only applies to Kids Category apps, the info URL is
 * optional, and the overrides default to NONE.
 */
const AGE_RATING_OPTIONAL = new Set([
  'ageRatingOverride',
  'ageRatingOverrideV2',
  'developerAgeRatingInfoUrl',
  'kidsAgeBand',
  'koreaAgeRatingOverride',
]);

/**
 * The app name is deliberately absent: App Store names are unique per account,
 * so writing the source's name onto the destination is rejected for as long as
 * the source holds it. Copying it is a manual decision, reported not attempted.
 */
const APP_INFO_LOC_FIELDS = [
  'subtitle',
  'privacyPolicyUrl',
  'privacyPolicyText',
  'privacyChoicesUrl',
];
const VERSION_LOC_FIELDS = [
  'description',
  'keywords',
  'promotionalText',
  'whatsNew',
  'marketingUrl',
  'supportUrl',
];
const REVIEW_DETAIL_FIELDS = [
  'contactFirstName',
  'contactLastName',
  'contactPhone',
  'contactEmail',
  'demoAccountName',
  'demoAccountPassword',
  'demoAccountRequired',
  'notes',
];
const CATEGORY_RELS = [
  'primaryCategory',
  'primarySubcategoryOne',
  'primarySubcategoryTwo',
  'secondaryCategory',
  'secondarySubcategoryOne',
  'secondarySubcategoryTwo',
];
/** Credentials are copied but never echoed. */
const CLONE_SECRET_FIELDS = new Set(['demoAccountPassword']);

/** One-line, quote-safe preview of a listing value for the plan output. */
function preview(field, v) {
  if (v === null || v === undefined) return '(unset)';
  if (CLONE_SECRET_FIELDS.has(field)) return '(set, hidden)';
  if (typeof v !== 'string') return String(v);
  if (!v) return '(empty)';
  const flat = v.replace(/\s+/g, ' ').trim();
  return `"${flat.length > 58 ? `${flat.slice(0, 58)}…` : flat}"`;
}

/** Fields whose source value is worth writing and differs from the target. */
function diffAttrs(fields, src, dst) {
  const out = {};
  for (const f of fields) {
    const from = src?.[f];
    if (from === null || from === undefined) continue;
    if (dst && dst[f] === from) continue;
    out[f] = from;
  }
  return out;
}

/**
 * ASC rejects the whole request when a single attribute collides, so one bad
 * field takes every unrelated field in the same call down with it: an app info
 * localization carries the privacy policy URL, which is itself required for
 * submission, alongside fields that can be refused. Retry once without the
 * attribute the error points at, and report which field was dropped.
 */
async function writeSalvaging(attrs, send) {
  try {
    await send(attrs);
    return null;
  } catch (e) {
    const field = e.message.match(
      /"pointer"\s*:\s*"\/data\/attributes\/(\w+)"/,
    )?.[1];
    const rest = {...attrs};
    delete rest[field];
    if (!field || !(field in attrs) || !Object.keys(rest).length) throw e;
    await send(rest);
    return field;
  }
}

/** The related resource itself (id + attributes), or null if unset. */
async function related(type, id, rel) {
  const r = await api('GET', `/v1/${type}/${id}/${rel}`).catch(() => null);
  return r?.data ?? null;
}
const relId = async (type, id, rel) =>
  (await related(type, id, rel))?.id ?? null;

/**
 * clone-listing's own version picker. The SOURCE record's version is usually
 * past PREPARE_FOR_SUBMISSION (it is the live/submitted listing we want to
 * copy), so pickVersion's editable-only rule does not apply. Default to the
 * newest version by creation date.
 */
async function pickAnyVersion(appId, want, label) {
  const vs = await listVersions(appId);
  if (!vs.length) throw new Error(`${label}: no ${OPTS.platform} versions`);
  if (want) {
    const v = vs.find(x => x.attributes.versionString === want);
    if (!v)
      throw new Error(
        `${label}: version ${want} not found (have: ${vs.map(x => x.attributes.versionString).join(', ')})`,
      );
    return v;
  }
  return [...vs].sort((a, b) =>
    String(b.attributes.createdDate).localeCompare(
      String(a.attributes.createdDate),
    ),
  )[0];
}

async function cmdCloneListing() {
  if (typeof OPTS.from !== 'string' || typeof OPTS.to !== 'string')
    throw new Error(
      'clone-listing requires --from <source app id> and --to <destination app id>',
    );
  if (OPTS.from === OPTS.to)
    throw new Error('clone-listing: --from and --to are the same record');
  const [srcId, dstId] = [OPTS.from, OPTS.to];

  const [srcApp, dstApp] = await Promise.all([
    api('GET', `/v1/apps/${srcId}`),
    api('GET', `/v1/apps/${dstId}`),
  ]);
  L(
    `FROM: ${srcApp.data.attributes.name} (${srcApp.data.attributes.bundleId}) id=${srcId}`,
  );
  L(
    `TO:   ${dstApp.data.attributes.name} (${dstApp.data.attributes.bundleId}) id=${dstId}`,
  );

  const [srcInfos, dstInfos] = await Promise.all([
    api('GET', `/v1/apps/${srcId}/appInfos?limit=10`),
    api('GET', `/v1/apps/${dstId}/appInfos?limit=10`),
  ]);
  const srcInfo = srcInfos.data[0];
  // The editable appInfo is the one still in PREPARE_FOR_SUBMISSION; a record
  // mid-review carries a second, frozen one.
  const dstInfo =
    dstInfos.data.find(
      i =>
        (i.attributes.state || i.attributes.appStoreState) ===
        'PREPARE_FOR_SUBMISSION',
    ) || dstInfos.data[0];
  if (!srcInfo || !dstInfo) throw new Error('appInfo missing on one record');

  const srcVer = await pickAnyVersion(srcId, OPTS.fromVersion, 'source');
  const dstVer = await pickAnyVersion(dstId, OPTS.toVersion, 'destination');
  L(
    `\nVERSION: ${srcVer.attributes.versionString} [${versState(srcVer)}] -> ` +
      `${dstVer.attributes.versionString} [${versState(dstVer)}]`,
  );
  const dstState = versState(dstVer);
  if (!EDITABLE_VERSION_STATES.includes(dstState))
    L(
      `  ⚠ destination version is ${dstState}; writes will likely be rejected`,
    );

  const steps = [];
  const failures = [];
  const skipped = [];
  const add = (section, label, run) => steps.push({section, label, run});

  // ---- app-level: contentRightsDeclaration
  const srcRights = srcApp.data.attributes.contentRightsDeclaration;
  const dstRights = dstApp.data.attributes.contentRightsDeclaration;
  if (srcRights && srcRights !== dstRights)
    add(
      'App',
      `contentRightsDeclaration ${dstRights ?? '(unset)'} -> ${srcRights}`,
      () =>
        api('PATCH', `/v1/apps/${dstId}`, {
          data: {
            type: 'apps',
            id: dstId,
            attributes: {contentRightsDeclaration: srcRights},
          },
        }),
    );

  // ---- app info: categories
  const cats = {};
  for (const rel of CATEGORY_RELS) {
    const [from, to] = await Promise.all([
      relId('appInfos', srcInfo.id, rel),
      relId('appInfos', dstInfo.id, rel),
    ]);
    if (from && from !== to) cats[rel] = {from, to};
  }
  if (Object.keys(cats).length)
    add(
      'App info',
      `categories: ${Object.entries(cats)
        .map(([k, v]) => `${k} ${v.to ?? '(unset)'} -> ${v.from}`)
        .join(', ')}`,
      () =>
        api('PATCH', `/v1/appInfos/${dstInfo.id}`, {
          data: {
            type: 'appInfos',
            id: dstInfo.id,
            relationships: Object.fromEntries(
              Object.entries(cats).map(([rel, v]) => [
                rel,
                {data: {type: 'appCategories', id: v.from}},
              ]),
            ),
          },
        }),
    );

  // ---- age rating declaration
  // ageRatingDeclarations is UPDATE-only: GET_INSTANCE is a 403, so the
  // attributes have to come off the appInfo relationship, not the resource.
  const [srcArd, dstArd] = await Promise.all([
    related('appInfos', srcInfo.id, 'ageRatingDeclaration'),
    related('appInfos', dstInfo.id, 'ageRatingDeclaration'),
  ]);
  const dstArdId = dstArd?.id ?? null;
  const ardAttrs = diffAttrs(
    AGE_RATING_FIELDS,
    srcArd?.attributes,
    dstArd?.attributes,
  );
  // Questions Apple has added since the source record last answered them: null
  // on both sides, so there is nothing to copy and a human must answer them.
  const ardUnanswered = AGE_RATING_FIELDS.filter(
    f =>
      !AGE_RATING_OPTIONAL.has(f) &&
      srcArd?.attributes?.[f] === null &&
      dstArd?.attributes?.[f] === null,
  );
  if (dstArdId && Object.keys(ardAttrs).length)
    add(
      'Age rating',
      `${Object.keys(ardAttrs).length} field(s): ${Object.entries(ardAttrs)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`,
      () =>
        api('PATCH', `/v1/ageRatingDeclarations/${dstArdId}`, {
          data: {
            type: 'ageRatingDeclarations',
            id: dstArdId,
            attributes: ardAttrs,
          },
        }),
    );

  // ---- app info localizations (subtitle, privacy policy; never the name)
  const [srcInfoLocs, dstInfoLocs] = await Promise.all([
    api('GET', `/v1/appInfos/${srcInfo.id}/appInfoLocalizations?limit=50`),
    api('GET', `/v1/appInfos/${dstInfo.id}/appInfoLocalizations?limit=50`),
  ]);
  // A new locale cannot be created without a name, so it gets the destination's
  // own name rather than the source's, which the destination may not take.
  const dstName =
    dstInfoLocs.data.find(l => l.attributes.name)?.attributes.name ||
    dstApp.data.attributes.name;
  for (const loc of srcInfoLocs.data) {
    const {locale} = loc.attributes;
    const existing = dstInfoLocs.data.find(l => l.attributes.locale === locale);
    const attrs = diffAttrs(
      APP_INFO_LOC_FIELDS,
      loc.attributes,
      existing?.attributes,
    );
    if (!Object.keys(attrs).length) continue;
    const body = Object.entries(attrs)
      .map(([k, v]) => `${k}=${preview(k, v)}`)
      .join(', ');
    if (existing)
      add('App info localization', `${locale} update: ${body}`, () =>
        writeSalvaging(attrs, a =>
          api('PATCH', `/v1/appInfoLocalizations/${existing.id}`, {
            data: {
              type: 'appInfoLocalizations',
              id: existing.id,
              attributes: a,
            },
          }),
        ),
      );
    else
      add(
        'App info localization',
        `${locale} CREATE: ${body}, name=${preview('name', dstName)} (the destination's own)`,
        () =>
          writeSalvaging({...attrs, name: dstName}, a =>
            api('POST', '/v1/appInfoLocalizations', {
              data: {
                type: 'appInfoLocalizations',
                attributes: {...a, locale},
                relationships: {
                  appInfo: {data: {type: 'appInfos', id: dstInfo.id}},
                },
              },
            }),
          ),
      );
  }

  // ---- version settings that gate a submission but live on the version itself
  const verAttrs = diffAttrs(
    ['copyright', 'releaseType'],
    srcVer.attributes,
    dstVer.attributes,
  );
  if (Object.keys(verAttrs).length)
    add(
      'Version',
      Object.entries(verAttrs)
        .map(
          ([k, v]) =>
            `${k} ${preview(k, dstVer.attributes[k])} -> ${preview(k, v)}`,
        )
        .join(', '),
      () =>
        api('PATCH', `/v1/appStoreVersions/${dstVer.id}`, {
          data: {
            type: 'appStoreVersions',
            id: dstVer.id,
            attributes: verAttrs,
          },
        }),
    );

  // ---- version localizations (description, keywords, promo, what's new, URLs)
  const [srcVerLocs, dstVerLocs] = await Promise.all([
    api(
      'GET',
      `/v1/appStoreVersions/${srcVer.id}/appStoreVersionLocalizations?limit=50`,
    ),
    api(
      'GET',
      `/v1/appStoreVersions/${dstVer.id}/appStoreVersionLocalizations?limit=50`,
    ),
  ]);
  for (const loc of srcVerLocs.data) {
    const {locale} = loc.attributes;
    const existing = dstVerLocs.data.find(l => l.attributes.locale === locale);
    const attrs = diffAttrs(
      VERSION_LOC_FIELDS,
      loc.attributes,
      existing?.attributes,
    );
    if (!Object.keys(attrs).length) continue;
    const body = Object.entries(attrs)
      .map(([k, v]) => `${k}=${preview(k, v)}`)
      .join(', ');
    if (existing)
      add('Version localization', `${locale} update: ${body}`, () =>
        api('PATCH', `/v1/appStoreVersionLocalizations/${existing.id}`, {
          data: {
            type: 'appStoreVersionLocalizations',
            id: existing.id,
            attributes: attrs,
          },
        }),
      );
    else
      add('Version localization', `${locale} CREATE: ${body}`, () =>
        api('POST', '/v1/appStoreVersionLocalizations', {
          data: {
            type: 'appStoreVersionLocalizations',
            attributes: {...attrs, locale},
            relationships: {
              appStoreVersion: {
                data: {type: 'appStoreVersions', id: dstVer.id},
              },
            },
          },
        }),
      );
  }

  // ---- review detail (notes, demo account, contact)
  const [srcDetail, dstDetail] = await Promise.all([
    api('GET', `/v1/appStoreVersions/${srcVer.id}/appStoreReviewDetail`).catch(
      () => null,
    ),
    api('GET', `/v1/appStoreVersions/${dstVer.id}/appStoreReviewDetail`).catch(
      () => null,
    ),
  ]);
  const srcDetailAttrs = srcDetail?.data?.attributes;
  const dstDetailId = dstDetail?.data?.id ?? null;
  const detailAttrs = diffAttrs(
    REVIEW_DETAIL_FIELDS,
    srcDetailAttrs,
    dstDetail?.data?.attributes,
  );
  if (Object.keys(detailAttrs).length) {
    const body = Object.entries(detailAttrs)
      .map(([k, v]) => `${k}=${preview(k, v)}`)
      .join(', ');
    if (dstDetailId)
      add('Review detail', `update: ${body}`, () =>
        api('PATCH', `/v1/appStoreReviewDetails/${dstDetailId}`, {
          data: {
            type: 'appStoreReviewDetails',
            id: dstDetailId,
            attributes: detailAttrs,
          },
        }),
      );
    else
      add('Review detail', `CREATE: ${body}`, () =>
        api('POST', '/v1/appStoreReviewDetails', {
          data: {
            type: 'appStoreReviewDetails',
            attributes: detailAttrs,
            relationships: {
              appStoreVersion: {
                data: {type: 'appStoreVersions', id: dstVer.id},
              },
            },
          },
        }),
      );
  }

  // ---- plan
  L('\nCOPY PLAN:');
  if (!steps.length) L('  (nothing to copy: the destination already matches)');
  let section = null;
  for (const s of steps) {
    if (s.section !== section) {
      L(`  ${s.section}:`);
      section = s.section;
    }
    L(`    - ${s.label}`);
  }

  if (OPTS.yes) {
    L('\nAPPLYING…');
    for (const s of steps) {
      try {
        const dropped = await s.run();
        if (dropped) skipped.push({step: s, field: dropped});
        L(
          `  ${dropped ? '~' : '✓'} ${s.section}: ${s.label.split(':')[0]}` +
            `${dropped ? ` (everything except ${dropped}, which ASC rejected)` : ''}`,
        );
      } catch (e) {
        failures.push({step: s, message: e.message});
        L(`  ✗ ${s.section}: ${s.label.split(':')[0]}`);
      }
    }
  }

  // ---- report
  L('\nNOT COPIED (do these by hand):');
  for (const [what, why] of CLONE_MANUAL) L(`  - ${what}: ${why}`);
  if (ardUnanswered.length)
    L(
      `  - Age rating questions unanswered on BOTH records: ${ardUnanswered.join(', ')}.\n` +
        '     Apple added these after the source record was last rated; answer them in ASC.',
    );
  const srcInfoState =
    srcInfo.attributes.state || srcInfo.attributes.appStoreState || 'unknown';
  L(
    '  - App name: never copied. App Store names are unique per account, so the\n' +
      `     destination cannot take "${srcApp.data.attributes.name}" while the source holds it, and the\n` +
      `     source's appInfo is ${srcInfoState}${srcInfoState === 'PREPARE_FOR_SUBMISSION' ? '' : ' (not editable, so the name cannot be freed there)'}.\n` +
      `     The destination reads "${dstApp.data.attributes.name}". Settle the name in ASC as its own step.\n` +
      '     See section 4 of BUNDLE_ID_MIGRATION.md.',
  );
  L(
    `  - Version string: the destination is on ${dstVer.attributes.versionString}. Reconcile it with\n` +
      `     \`node scripts/asc.mjs rename --app-id ${dstId} --to <version> --yes\`.`,
  );

  // Each of these blocks a submission on its own and fails late and unhelpfully
  // in ASC, so say it loudly. Which of them is actually missing is read off the
  // records on every run: the portal is edited by hand, and a field that was
  // null earlier in the day can be populated by the time you look again. Never
  // encode a snapshot of what a fresh record lacks.
  L('\nSUBMISSION BLOCKERS (live state as of this run):');
  const willCopy = sec => steps.some(s => s.section === sec);
  const blockerLine = (name, ok, planned, detail, partial) => {
    const fixed = OPTS.yes ? 'FIXED' : 'WILL BE FIXED by --yes';
    // `partial` outranks `ok`: a field that is set but still has unanswered
    // questions behind it must never report as OK.
    let state = 'BLOCKED';
    if (ok && !partial) state = 'OK';
    else if (ok && partial) state = 'PARTIAL: copied, finish the rest by hand';
    else if (planned && partial)
      state = `PARTIAL: ${fixed}, then finish by hand`;
    else if (planned) state = fixed;
    L(`  [${state}] ${name}${detail ? ` (${detail})` : ''}`);
    return (ok || planned) && !partial;
  };
  const okRights = blockerLine(
    'contentRightsDeclaration',
    Boolean(dstRights),
    Boolean(srcRights) && srcRights !== dstRights,
    srcRights ? `source: ${srcRights}` : 'unset on the source record too',
  );
  // A record that has never been rated has every question null, so one
  // answered content question is the tell that the declaration exists at all.
  const dstRated =
    dstArd?.attributes?.alcoholTobaccoOrDrugUseOrReferences !== null &&
    dstArd?.attributes?.alcoholTobaccoOrDrugUseOrReferences !== undefined;
  const okRating = blockerLine(
    'age rating declaration',
    dstRated,
    Boolean(dstArdId) && Object.keys(ardAttrs).length > 0,
    ardUnanswered.length
      ? `${ardUnanswered.join(', ')} unanswered on both records`
      : '',
    ardUnanswered.length > 0,
  );
  const demoRequired = srcDetailAttrs?.demoAccountRequired === true;
  const demoPresent = Boolean(
    dstDetail?.data?.attributes?.demoAccountName &&
      dstDetail?.data?.attributes?.demoAccountPassword,
  );
  const demoCopied =
    demoRequired &&
    Boolean(srcDetailAttrs?.demoAccountName) &&
    willCopy('Review detail');
  const okDemo = blockerLine(
    'review detail + demo account',
    demoPresent || !demoRequired,
    demoCopied,
    demoRequired ? 'the source sets demoAccountRequired=true' : '',
  );

  if (skipped.length) {
    L('\nPARTIALLY COPIED:');
    for (const sk of skipped)
      L(
        `  ~ ${sk.step.section}: ${sk.step.label.split(':')[0]} went through ` +
          `without ${sk.field}. Set ${sk.field} by hand once the conflict is cleared.`,
      );
  }

  if (failures.length) {
    L('\nFAILED:');
    for (const f of failures) {
      L(`  ✗ ${f.step.section}: ${f.step.label}`);
      L(`     ${f.message.split('\n')[0]}`);
      if (/name.*(taken|unique|use)/i.test(f.message))
        L('     Hint: free the app name on the source record first.');
    }
    process.exitCode = 1;
  }

  if (!OPTS.yes) {
    L('\nDRY RUN. Pass --yes to write to App Store Connect.');
    return;
  }
  if (!okRights || !okRating || !okDemo)
    L('\n⚠ At least one submission blocker is still unresolved (see above).');
}

async function cmdRename(appId) {
  if (!OPTS.to) throw new Error('rename requires --to <new version string>');
  const v = await pickVersion(appId);
  const app = await api('GET', `/v1/apps/${appId}`);
  L(
    `APP: ${app.data.attributes.name} (${app.data.attributes.bundleId}) id=${appId}`,
  );
  L(
    `Renaming ${v.attributes.versionString} (${versState(v)}) id=${v.id} -> ${OPTS.to}`,
  );
  if (!OPTS.yes) {
    L(`\nPlan: PATCH appStoreVersions/${v.id} versionString=${OPTS.to}`);
    L('\nDRY RUN. Pass --yes to write to App Store Connect.');
    return;
  }
  const done = await api('PATCH', `/v1/appStoreVersions/${v.id}`, {
    data: {
      type: 'appStoreVersions',
      id: v.id,
      attributes: {versionString: OPTS.to},
    },
  });
  L(
    `Renamed ✓  ${done.data.attributes.versionString} state=${versState(done.data)}`,
  );
}

// ---- preflight ------------------------------------------------------------

/**
 * Screenshot slots App Store Connect refuses a submission without.
 *
 * APP_IPHONE_67 is the baseline iPhone slot (it takes 1320x2868 as well as
 * 1290x2796). APP_WATCH_SERIES_4 (368x448) is required because all three
 * schemes embed `Kiroku Watch App.app`, and that is the slot ASC names when it
 * refuses the iOS submission. iPad is deliberately absent: the listing has
 * never carried an iPad set and the framing pipeline emits none.
 */
const REQUIRED_DISPLAY_TYPES = ['APP_IPHONE_67', 'APP_WATCH_SERIES_4'];

/**
 * Age rating answers that only become required once another answer makes them
 * apply. Apple's questionnaire hides `socialMediaAgeRestricted` until the app
 * declares social media features, so a null there is an answer while
 * `socialMedia` is false, and a blocker once it is true. `socialMedia` itself
 * is unconditional and was found unanswered on both Kiroku records.
 */
const AGE_RATING_CONDITIONAL = {
  socialMediaAgeRestricted: a => a.socialMedia === true,
};

/**
 * Review submission states that make a new submission impossible. A leftover
 * READY_FOR_REVIEW one is deliberately NOT here: it was created and never
 * submitted, and `submit` reuses it rather than failing on the POST.
 */
const COLLIDING_SUBMISSION_STATES = [
  'WAITING_FOR_REVIEW',
  'IN_REVIEW',
  'UNRESOLVED_ISSUES',
];

const IOS_INFO_PLIST = path.join(ROOT, 'ios', 'kiroku', 'Info.plist');
const CONST_TS = path.join(ROOT, 'src', 'CONST.ts');

/** A `<key>k</key><string|true|false/>` value out of the iOS Info.plist. */
function plistValue(key) {
  const xml = fs.readFileSync(IOS_INFO_PLIST, 'utf8');
  const m = xml.match(
    new RegExp(
      `<key>${key}</key>\\s*(?:<string>([^<]*)</string>|<(true|false)/>)`,
    ),
  );
  if (!m) return null;
  return m[1] !== undefined ? m[1].trim() : m[2];
}

/**
 * The tip-jar product ids the binary asks StoreKit for. Read out of CONST.ts
 * rather than restated here: that array is what the app compiles in, StoreKit
 * silently omits any id App Store Connect does not carry, and the ids are
 * burn-once, so the record has to match the binary exactly.
 */
function tipProductIds() {
  const src = fs.readFileSync(CONST_TS, 'utf8');
  const block = src.match(/PRODUCT_IDS:\s*\[([^\]]*)\]/);
  const ids = block ? [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : [];
  if (!ids.length)
    throw new Error(`CONST.TIPS.PRODUCT_IDS not readable from ${CONST_TS}`);
  return ids;
}

/**
 * preflight's own version picker. `pickVersion` throws when the target is
 * ambiguous, which would take the whole report down with it; preflight would
 * rather report a bad version as a failed check. Prefers --version, then the
 * version this repo builds, then the lone editable one, then the newest.
 */
function pickPreflightVersion(versions, wanted) {
  if (OPTS.version)
    return (
      versions.find(v => v.attributes.versionString === OPTS.version) ?? null
    );
  const byPlist = versions.find(v => v.attributes.versionString === wanted);
  if (byPlist) return byPlist;
  const editable = versions.filter(v =>
    EDITABLE_VERSION_STATES.includes(versState(v)),
  );
  if (editable.length === 1) return editable[0];
  return (
    [...versions].sort((a, b) =>
      String(b.attributes.createdDate).localeCompare(
        String(a.attributes.createdDate),
      ),
    )[0] ?? null
  );
}

/** Screenshot sets on one version localization, keyed by display type. */
async function screenshotSets(localizationId) {
  const sets = await api(
    'GET',
    `/v1/appStoreVersionLocalizations/${localizationId}/appScreenshotSets?limit=50`,
  );
  const out = new Map();
  for (const set of sets.data) {
    const shots = await api(
      'GET',
      `/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`,
    );
    out.set(set.attributes.screenshotDisplayType, shots.data);
  }
  return out;
}

/**
 * Every precondition for a first submission of this record, as one pass/fail
 * report. Read-only: it issues nothing but GETs, so it is safe to run at any
 * point and usable as a gate (exit 1 on any failure).
 */
async function cmdPreflight(appId) {
  const app = await api('GET', `/v1/apps/${appId}`);
  const appAttrs = app.data.attributes;
  L(`PREFLIGHT: ${appAttrs.name} (${appAttrs.bundleId}) id=${appId}`);

  const rows = [];
  const check = (name, ok, ...details) => {
    rows.push({name, ok: Boolean(ok), details: details.flat().filter(Boolean)});
    return Boolean(ok);
  };
  const report = () => {
    L('');
    for (const r of rows) {
      L(`  [${r.ok ? 'PASS' : 'FAIL'}] ${r.name}`);
      for (const d of r.details) L(`         ${d}`);
    }
    L('');
    L('Not checked here (the API does not expose them):');
    L(
      '  - App Privacy nutrition labels: /v1/appDataUsages and appPrivacyDetails both 404.',
    );
    L('  - Pricing and availability: set in ASC > Pricing and Availability.');
    L(
      '  - RevenueCat dashboard: see section 5 of contributingGuides/BUNDLE_ID_MIGRATION.md.',
    );
    const failed = rows.filter(r => !r.ok).length;
    L(`\n${rows.length - failed}/${rows.length} checks passed.`);
    if (!failed) {
      L('Ready to submit.');
      return 0;
    }
    L(`BLOCKED by ${failed} check(s):`);
    for (const r of rows.filter(x => !x.ok)) L(`  - ${r.name}`);
    return 1;
  };

  // ---- version --------------------------------------------------------
  const wanted = plistValue('CFBundleShortVersionString');
  const versions = await listVersions(appId);
  const version = pickPreflightVersion(versions, wanted);
  const state = version ? versState(version) : null;
  const known = versions.map(v => v.attributes.versionString).join(', ');
  let versionDetail = `no ${OPTS.platform} version on this record`;
  if (version)
    versionDetail = `${version.attributes.versionString} [${state}] id=${version.id}`;
  else if (OPTS.version)
    versionDetail = `version ${OPTS.version} not found (have: ${known || 'none'})`;
  check(
    'version exists and is editable',
    version && EDITABLE_VERSION_STATES.includes(state),
    versionDetail,
    version && !EDITABLE_VERSION_STATES.includes(state)
      ? `expected ${EDITABLE_VERSION_STATES.join(' or ')}`
      : null,
  );
  if (!version) return report();

  const asc = version.attributes.versionString;
  check(
    'versionString matches ios/kiroku/Info.plist',
    asc === wanted,
    `Info.plist CFBundleShortVersionString=${wanted}, App Store Connect=${asc}`,
    asc === wanted
      ? null
      : `reconcile with: node scripts/asc.mjs rename --app-id ${appId} --to ${wanted} --yes`,
  );

  // ---- build ----------------------------------------------------------
  const build = await fetchBuild(version.id);
  const b = build?.attributes;
  check(
    'build attached, VALID and not expired',
    b && b.processingState === 'VALID' && b.expired !== true,
    b
      ? `${b.version} uploaded=${b.uploadedDate ?? '?'} processing=${b.processingState} expired=${b.expired}`
      : `no build attached to ${asc}`,
    b
      ? null
      : `upload a build built against ${appAttrs.bundleId} and attach it`,
  );

  // Export compliance rides on the build, so it cannot be answered before one
  // exists. Info.plist's ITSAppUsesNonExemptEncryption is what answers it
  // automatically at upload time.
  const plistEncryption = plistValue('ITSAppUsesNonExemptEncryption');
  check(
    'export compliance answered (usesNonExemptEncryption)',
    b &&
      b.usesNonExemptEncryption !== null &&
      b.usesNonExemptEncryption !== undefined,
    b
      ? `build usesNonExemptEncryption=${b.usesNonExemptEncryption}`
      : 'no build attached, so there is nothing to answer it on',
    `ios/kiroku/Info.plist ITSAppUsesNonExemptEncryption=${plistEncryption ?? '(unset)'}, which answers this at upload`,
  );

  // ---- app-level declarations -----------------------------------------
  check(
    'contentRightsDeclaration set',
    Boolean(appAttrs.contentRightsDeclaration),
    appAttrs.contentRightsDeclaration ??
      'unset (ASC > App Information > Content Rights)',
  );

  const infos = await api('GET', `/v1/apps/${appId}/appInfos?limit=10`);
  const info =
    infos.data.find(
      i =>
        (i.attributes.state || i.attributes.appStoreState) ===
        'PREPARE_FOR_SUBMISSION',
    ) || infos.data[0];
  const ard = info
    ? await related('appInfos', info.id, 'ageRatingDeclaration')
    : null;
  const ardAttrs = ard?.attributes ?? {};
  // Unanswered means null on a question that applies. Apple keeps adding
  // questions to an existing declaration, so a record rated years ago can go
  // incomplete without anyone touching it: socialMedia is exactly that case.
  const unanswered = AGE_RATING_FIELDS.filter(f => {
    if (AGE_RATING_OPTIONAL.has(f)) return false;
    const applies = AGE_RATING_CONDITIONAL[f];
    if (applies && !applies(ardAttrs)) return false;
    return ardAttrs[f] === null || ardAttrs[f] === undefined;
  });
  check(
    'age rating declaration complete',
    ard && !unanswered.length,
    ard ? null : 'no age rating declaration on the editable appInfo',
    unanswered.length ? `unanswered: ${unanswered.join(', ')}` : null,
    unanswered.length
      ? 'answer them in ASC > App Information > Age Rating (the API will not derive them)'
      : `appStoreAgeRating=${info?.attributes?.appStoreAgeRating ?? '?'}`,
    ardAttrs.socialMedia === false
      ? 'socialMedia=false, so socialMediaAgeRestricted does not apply'
      : null,
  );

  // ---- review detail ---------------------------------------------------
  const detail = await api(
    'GET',
    `/v1/appStoreVersions/${version.id}/appStoreReviewDetail`,
  ).catch(() => null);
  const d = detail?.data?.attributes;
  const demoRequired = d?.demoAccountRequired === true;
  const demoPresent = Boolean(d?.demoAccountName && d?.demoAccountPassword);
  const contactMissing = [
    'contactFirstName',
    'contactLastName',
    'contactEmail',
    'contactPhone',
  ].filter(f => !d?.[f]);
  check(
    'review detail present, with a demo account when required',
    d && !contactMissing.length && (!demoRequired || demoPresent),
    d ? null : 'no appStoreReviewDetail on this version',
    contactMissing.length
      ? `missing contact fields: ${contactMissing.join(', ')}`
      : null,
    d
      ? `demoAccountRequired=${d.demoAccountRequired}, demo account ${demoPresent ? 'set' : 'NOT set'}, notes ${d.notes ? `${d.notes.length} chars` : 'empty'}`
      : null,
  );

  // ---- screenshots -----------------------------------------------------
  const locs = await api(
    'GET',
    `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`,
  );
  const primary = appAttrs.primaryLocale;
  const primaryLoc = locs.data.find(l => l.attributes.locale === primary);
  const sets = primaryLoc ? await screenshotSets(primaryLoc.id) : new Map();
  const shotDetails = [];
  let shotsOk = Boolean(primaryLoc);
  for (const type of REQUIRED_DISPLAY_TYPES) {
    const shots = sets.get(type) ?? [];
    const complete = shots.filter(
      s => s.attributes.assetDeliveryState?.state === 'COMPLETE',
    );
    if (!complete.length) shotsOk = false;
    shotDetails.push(
      `${type}: ${complete.length} complete of ${shots.length}${complete.length ? '' : ' (MISSING)'}`,
    );
  }
  const extra = [...sets.keys()].filter(
    t => !REQUIRED_DISPLAY_TYPES.includes(t),
  );
  const otherLocales = locs.data
    .map(l => l.attributes.locale)
    .filter(l => l !== primary);
  check(
    `screenshots for every required display type (${primary})`,
    shotsOk,
    primaryLoc ? null : `no ${primary} localization on this version`,
    shotDetails,
    extra.length ? `also present (not required): ${extra.join(', ')}` : null,
    shotsOk
      ? null
      : 'upload with: node scripts/asc.mjs shots --dir <folder> --locale ' +
          `${primary} --replace --yes  (see contributingGuides/SCREENSHOTS.md)`,
    otherLocales.length
      ? `${otherLocales.join(', ')} fall back to the ${primary} screenshots unless given their own`
      : null,
  );

  // ---- tip products ----------------------------------------------------
  const wantedIds = tipProductIds();
  const iaps = await iapsByProductId(appId);
  const iapDetails = [];
  let iapsOk = true;
  for (const productId of wantedIds) {
    const iap = iaps.get(productId);
    if (!iap) {
      iapsOk = false;
      iapDetails.push(`${productId}: NOT CREATED`);
      continue;
    }
    const shot = await api(
      'GET',
      `/v2/inAppPurchases/${iap.id}/appStoreReviewScreenshot`,
    ).catch(() => null);
    const shotState = shot?.data?.attributes?.assetDeliveryState?.state;
    const ok =
      iap.attributes.state === 'READY_TO_SUBMIT' && shotState === 'COMPLETE';
    if (!ok) iapsOk = false;
    iapDetails.push(
      `${productId}: ${iap.attributes.state}, review screenshot ${shotState ?? 'NOT SET'}`,
    );
  }
  check(
    'tip products exist, READY_TO_SUBMIT, with review screenshots',
    iapsOk,
    iapDetails,
    iapsOk
      ? null
      : 'fix with: node scripts/asc-tips.mjs setup / screenshot <png> (see contributingGuides/TIP_JAR.md)',
    iapsOk
      ? null
      : 'they must ride the app version: node scripts/asc.mjs submit --iaps ' +
          `${wantedIds.join(',')} --yes`,
  );

  // ---- open review submissions -----------------------------------------
  const subs = await api(
    'GET',
    `/v1/reviewSubmissions?filter[app]=${appId}&filter[platform]=${OPTS.platform}&limit=20`,
  );
  const colliding = subs.data.filter(s =>
    COLLIDING_SUBMISSION_STATES.includes(s.attributes.state),
  );
  const stray = subs.data.filter(
    s => s.attributes.state === 'READY_FOR_REVIEW',
  );
  check(
    'no open review submission in the way',
    !colliding.length,
    colliding.map(
      s =>
        `${s.id} state=${s.attributes.state} submitted=${s.attributes.submittedDate ?? '-'}`,
    ),
    colliding.length
      ? 'App Store Connect allows one open submission per platform; withdraw it first'
      : null,
    stray.length
      ? `${stray.length} unsubmitted READY_FOR_REVIEW submission(s) present; \`submit\` reuses and clears them`
      : null,
  );

  // ---- listing text ----------------------------------------------------
  const hits = await scanListing(version.id);
  check(
    'listing text free of forbidden terms',
    !hits.length,
    `terms: ${termList().join(', ')}`,
    hits.map(h => `${h.locale} ${h.field}: "${h.term}"`),
  );

  return report();
}

// ---- main -----------------------------------------------------------------
(async () => {
  if (OPTS.help || !cmd) return usage();
  const k = JSON.parse(fs.readFileSync(OPTS.keyPath, 'utf8'));
  if (!k.key_id || !k.issuer_id || !k.key)
    throw new Error(`Key JSON missing key_id/issuer_id/key: ${OPTS.keyPath}`);
  TOKEN = mintToken(k);

  // clone-listing addresses two records explicitly, so it skips the
  // bundle-id -> app-id lookup every other command starts from.
  if (cmd === 'clone-listing') return cmdCloneListing();

  const appId = await resolveAppId();

  if (cmd === 'status') return cmdStatus(appId);
  if (cmd === 'preflight') {
    process.exitCode = await cmdPreflight(appId);
    return;
  }
  if (cmd === 'scrub') {
    process.exitCode = await cmdScrub(appId);
    return;
  }
  if (cmd === 'shots') return cmdShots(appId);
  if (cmd === 'submit') return cmdSubmit(appId);
  if (cmd === 'rename') return cmdRename(appId);
  usage();
  process.exitCode = 1;
})().catch(e => {
  console.error('ERROR', e.message);
  process.exit(1);
});
