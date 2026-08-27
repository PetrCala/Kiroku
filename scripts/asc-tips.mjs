#!/usr/bin/env node
/**
 * Kiroku tip-jar in-app purchases: create and inspect them in App Store
 * Connect (zero-dependency, same auth as scripts/asc.mjs).
 *
 * The products are defined here, once, and must stay in step with
 * CONST.TIPS.PRODUCT_IDS in src/CONST.ts, because StoreKit silently omits any
 * id it does not recognize. The manual half of the setup (agreements, banking,
 * submission) is in contributingGuides/TIP_JAR.md.
 *
 * Usage:
 *   node scripts/asc-tips.mjs status
 *   node scripts/asc-tips.mjs setup
 *   node scripts/asc-tips.mjs screenshot <path-to-png>
 *
 * Every command is idempotent: `setup` skips what already exists, so it is
 * safe to re-run after a failure partway through. Transient 5xx responses are
 * retried.
 *
 * Flags:
 *   --bundle-id <id>   app bundle id (default: org.reactjs.native.example.alcohol-tracker)
 *   --app-id <id>      ASC app id (skips the bundle-id lookup)
 *   --key <path>       ASC API key JSON (default: <repo>/ios/ios-fastlane-json-key.json)
 */
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://api.appstoreconnect.apple.com';
const DEFAULT_BUNDLE_ID = 'org.reactjs.native.example.alcohol-tracker';
const L = (s = '') => console.log(s);

// Apple's limits: reference name 64 chars, localization name 30, description 45.
const REVIEW_NOTE =
  'Optional tip. It unlocks no features, content, or functionality: the app ' +
  'behaves identically whether or not a tip is ever given, and no part of ' +
  'the app is gated. Consumable so it can be given more than once; there is ' +
  'nothing to restore. To see it: Settings > Support Kiroku.';

// Base prices are CZK in the CZE territory; Apple derives every other
// territory from them. Must stay in step with CONST.TIPS.PRODUCT_IDS.
const TIPS = [
  {
    productId: 'kiroku.tip.small_beer',
    name: 'Tip: small beer',
    czk: 49,
    locales: {
      'en-US': {
        name: 'A small beer',
        description: 'A small thank-you beer. Unlocks nothing.',
      },
      cs: {
        name: 'Malé pivo',
        description: 'Malé pivo jako poděkování. Nic neodemyká.',
      },
    },
  },
  {
    productId: 'kiroku.tip.pint',
    name: 'Tip: pint',
    czk: 99,
    locales: {
      'en-US': {
        name: 'A pint',
        description: 'A pint of thanks. Unlocks nothing.',
      },
      cs: {
        name: 'Velké pivo',
        description: 'Velké pivo jako poděkování. Nic neodemyká.',
      },
    },
  },
  {
    productId: 'kiroku.tip.round',
    name: 'Tip: round',
    czk: 249,
    locales: {
      'en-US': {
        name: 'A round',
        description: 'A round of thanks. Unlocks nothing.',
      },
      cs: {
        name: 'Runda',
        description: 'Runda jako poděkování. Nic neodemyká.',
      },
    },
  },
];

// ---- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
function flag(name, def) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const OPTS = {
  bundleId: flag('bundle-id', process.env.ASC_BUNDLE_ID || DEFAULT_BUNDLE_ID),
  appId: flag('app-id', process.env.ASC_APP_ID),
  keyPath: flag(
    'key',
    process.env.ASC_KEY_JSON ||
      path.join(ROOT, 'ios', 'ios-fastlane-json-key.json'),
  ),
};

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
  for (let attempt = 1; ; attempt++) {
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
    if (res.ok) return parsed;
    if (res.status >= 500 && attempt < 3) {
      await new Promise(resolve => {
        setTimeout(resolve, 1000 * attempt);
      });
      continue;
    }
    const err = new Error(
      `HTTP ${res.status} ${method} ${url}\n${JSON.stringify(parsed, null, 2)}`,
    );
    err.status = res.status;
    throw err;
  }
}

/** GET that treats a 404 as "not created yet" rather than an error. */
async function optional(p) {
  try {
    return await api('GET', p);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

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

// ---- product plumbing -----------------------------------------------------
async function productsById(appId) {
  const page = await api('GET', `/v1/apps/${appId}/inAppPurchasesV2?limit=200`);
  return new Map(page.data.map(p => [p.attributes.productId, p]));
}

async function create(appId, tip, existing) {
  if (existing.has(tip.productId)) {
    L(`product exists: ${tip.productId}`);
    return existing.get(tip.productId).id;
  }
  const created = await api('POST', '/v2/inAppPurchases', {
    data: {
      type: 'inAppPurchases',
      attributes: {
        name: tip.name,
        productId: tip.productId,
        inAppPurchaseType: 'CONSUMABLE',
        reviewNote: REVIEW_NOTE,
        familySharable: false,
      },
      relationships: {app: {data: {type: 'apps', id: appId}}},
    },
  });
  L(`product created: ${tip.productId}`);
  return created.data.id;
}

async function localize(tip, id) {
  const current = await api(
    'GET',
    `/v2/inAppPurchases/${id}/inAppPurchaseLocalizations?limit=50`,
  );
  const have = new Set(current.data.map(l => l.attributes.locale));
  for (const [locale, copy] of Object.entries(tip.locales)) {
    if (have.has(locale)) continue;
    await api('POST', '/v1/inAppPurchaseLocalizations', {
      data: {
        type: 'inAppPurchaseLocalizations',
        attributes: {locale, name: copy.name, description: copy.description},
        relationships: {
          inAppPurchaseV2: {data: {type: 'inAppPurchases', id}},
        },
      },
    });
    L(`  localized: ${locale} => ${copy.name}`);
  }
}

async function setAvailability(id, territories) {
  if (await optional(`/v2/inAppPurchases/${id}/inAppPurchaseAvailability`))
    return;
  await api('POST', '/v1/inAppPurchaseAvailabilities', {
    data: {
      type: 'inAppPurchaseAvailabilities',
      attributes: {availableInNewTerritories: true},
      relationships: {
        inAppPurchase: {data: {type: 'inAppPurchases', id}},
        availableTerritories: {
          data: territories.map(t => ({type: 'territories', id: t})),
        },
      },
    },
  });
  L(`  availability: ${territories.length} territories`);
}

async function setPrice(tip, id) {
  // A price schedule resource exists as soon as the product does, so its
  // existence proves nothing. What matters is whether it carries a price.
  const manual = await api(
    'GET',
    `/v1/inAppPurchasePriceSchedules/${id}/manualPrices?limit=10`,
  );
  if (manual.data.length > 0) return;

  let pricePointId = null;
  const seen = [];
  let url = `/v2/inAppPurchases/${id}/pricePoints?filter[territory]=CZE&limit=200`;
  while (url && !pricePointId) {
    const page = await api('GET', url);
    for (const p of page.data) {
      const price = Number(p.attributes.customerPrice);
      seen.push(price);
      if (price === tip.czk) pricePointId = p.id;
    }
    url = page.links?.next?.replace(BASE, '') ?? null;
  }
  if (!pricePointId) {
    const nearest = [...new Set(seen)]
      .sort((a, b) => Math.abs(a - tip.czk) - Math.abs(b - tip.czk))
      .slice(0, 10)
      .sort((a, b) => a - b);
    throw new Error(
      `no CZE price point for ${tip.czk} Kč on ${tip.productId}; ` +
        `nearest available: ${nearest.join(', ')}. ` +
        `Adjust the czk value in scripts/asc-tips.mjs and re-run.`,
    );
  }

  // One manual price in the base territory; Apple derives all the others.
  await api('POST', '/v1/inAppPurchasePriceSchedules', {
    data: {
      type: 'inAppPurchasePriceSchedules',
      relationships: {
        inAppPurchase: {data: {type: 'inAppPurchases', id}},
        baseTerritory: {data: {type: 'territories', id: 'CZE'}},
        // '${price}' is a literal ASC API placeholder that binds the schedule
        // to the included inAppPurchasePrices resource, not an interpolation.
        // eslint-disable-next-line no-template-curly-in-string
        manualPrices: {data: [{type: 'inAppPurchasePrices', id: '${price}'}]},
      },
    },
    included: [
      {
        type: 'inAppPurchasePrices',
        // eslint-disable-next-line no-template-curly-in-string
        id: '${price}',
        attributes: {startDate: null, endDate: null},
        relationships: {
          inAppPurchasePricePoint: {
            data: {type: 'inAppPurchasePricePoints', id: pricePointId},
          },
        },
      },
    ],
  });
  L(`  price: ${tip.czk} Kč (CZE base)`);
}

async function setup(appId) {
  // An in-app purchase can only be sold where the app is sold. An app whose
  // availability was never explicitly edited has NO appAvailabilityV2 resource
  // (the endpoint 404s) and is sold everywhere by default, so fall back to the
  // full territory list in that case.
  let territories;
  const availability = await optional(`/v1/apps/${appId}/appAvailabilityV2`);
  if (availability) {
    const page = await api(
      'GET',
      `/v2/appAvailabilities/${availability.data.id}/territoryAvailabilities?limit=200&include=territory`,
    );
    territories = page.data
      .filter(t => t.attributes.available)
      .map(t => t.relationships.territory.data.id);
  } else {
    territories = [];
    let url = '/v1/territories?limit=200';
    while (url) {
      const page = await api('GET', url);
      territories.push(...page.data.map(t => t.id));
      url = page.links?.next?.replace(BASE, '') ?? null;
    }
    L(
      `app availability not explicitly set; using all ${territories.length} territories`,
    );
  }

  const existing = await productsById(appId);
  for (const tip of TIPS) {
    const id = await create(appId, tip, existing);
    await localize(tip, id);
    await setAvailability(id, territories);
    await setPrice(tip, id);
  }
}

async function status(appId) {
  const existing = await productsById(appId);
  for (const tip of TIPS) {
    const iap = existing.get(tip.productId);
    if (!iap) {
      L(`${tip.productId}  NOT CREATED`);
      continue;
    }
    const [locs, manual, availability, shot] = await Promise.all([
      api(
        'GET',
        `/v2/inAppPurchases/${iap.id}/inAppPurchaseLocalizations?limit=10`,
      ),
      api(
        'GET',
        `/v1/inAppPurchasePriceSchedules/${iap.id}/manualPrices?include=inAppPurchasePricePoint&limit=10`,
      ),
      optional(`/v2/inAppPurchases/${iap.id}/inAppPurchaseAvailability`),
      optional(`/v2/inAppPurchases/${iap.id}/appStoreReviewScreenshot`),
    ]);
    const price = manual.included?.[0]?.attributes;
    L(`\n${tip.productId}  [${iap.attributes.state}]`);
    L(`  type        : ${iap.attributes.inAppPurchaseType}`);
    L(
      `  price       : ${price ? `${price.customerPrice} (CZE base)` : 'NOT SET'}`,
    );
    L(
      `  locales     : ${locs.data.map(l => l.attributes.locale).join(', ') || 'NONE'}`,
    );
    L(`  availability: ${availability ? 'set' : 'NOT SET'}`);
    L(`  review note : ${iap.attributes.reviewNote ? 'set' : 'NOT SET'}`);
    L(
      `  screenshot  : ${shot?.data?.attributes?.assetDeliveryState?.state ?? 'NOT SET'}`,
    );
  }
}

// App Store Connect validates review screenshots against a fixed list of
// dimensions and rejects anything else with IMAGE_INCORRECT_DIMENSIONS, well
// after the upload appears to succeed (the failure shows up only in
// assetDeliveryState, never as an HTTP error). A phone screenshot is not on
// the accepted list; 640x920 is.
const REVIEW_WIDTH = 640;
const REVIEW_HEIGHT = 920;

/** Read a PNG's dimensions out of its IHDR chunk. */
function pngSize(bytes) {
  return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
}

/** Scale to fit and letterbox onto white, so the aspect ratio survives. */
function toReviewSize(file) {
  const fitted = path.join(tmpdir(), 'asc-review-fit.png');
  const padded = path.join(tmpdir(), 'asc-review.png');
  execFileSync('sips', ['-Z', String(REVIEW_HEIGHT), file, '--out', fitted], {
    stdio: 'ignore',
  });
  execFileSync(
    'sips',
    // prettier-ignore
    [
      '-p', String(REVIEW_HEIGHT), String(REVIEW_WIDTH),
      '--padColor', 'FFFFFF',
      fitted, '--out', padded,
    ],
    {stdio: 'ignore'},
  );
  return padded;
}

/** Upload one PNG as the review screenshot for every tip product. */
async function screenshot(appId, input) {
  if (!input) throw new Error('usage: asc-tips.mjs screenshot <path-to-png>');

  let file = input;
  const source = pngSize(fs.readFileSync(input));
  if (source.width !== REVIEW_WIDTH || source.height !== REVIEW_HEIGHT) {
    file = toReviewSize(input);
    L(
      `resized ${source.width}x${source.height} -> ${REVIEW_WIDTH}x${REVIEW_HEIGHT} (${file})`,
    );
  }

  const bytes = fs.readFileSync(file);
  const fileSize = fs.statSync(file).size;
  const fileName = path.basename(file);
  const sourceFileChecksum = crypto
    .createHash('md5')
    .update(bytes)
    .digest('hex');

  const existing = await productsById(appId);
  for (const tip of TIPS) {
    const iap = existing.get(tip.productId);
    if (!iap) throw new Error(`${tip.productId} not created yet; run setup`);

    const current = await optional(
      `/v2/inAppPurchases/${iap.id}/appStoreReviewScreenshot`,
    );
    if (current?.data) {
      await api(
        'DELETE',
        `/v1/inAppPurchaseAppStoreReviewScreenshots/${current.data.id}`,
      );
    }

    const reserved = await api(
      'POST',
      '/v1/inAppPurchaseAppStoreReviewScreenshots',
      {
        data: {
          type: 'inAppPurchaseAppStoreReviewScreenshots',
          attributes: {fileName, fileSize},
          // The relationship is inAppPurchaseV2, not inAppPurchase; the wrong
          // name comes back as a 409, not a 400.
          relationships: {
            inAppPurchaseV2: {data: {type: 'inAppPurchases', id: iap.id}},
          },
        },
      },
    );

    for (const op of reserved.data.attributes.uploadOperations) {
      const res = await fetch(op.url, {
        method: op.method,
        headers: Object.fromEntries(
          op.requestHeaders.map(h => [h.name, h.value]),
        ),
        body: bytes.subarray(op.offset, op.offset + op.length),
      });
      if (!res.ok) throw new Error(`upload chunk -> ${res.status}`);
    }

    const done = await api(
      'PATCH',
      `/v1/inAppPurchaseAppStoreReviewScreenshots/${reserved.data.id}`,
      {
        data: {
          type: 'inAppPurchaseAppStoreReviewScreenshots',
          id: reserved.data.id,
          attributes: {uploaded: true, sourceFileChecksum},
        },
      },
    );
    L(
      `screenshot uploaded: ${tip.productId} ${done.data.attributes.assetDeliveryState?.state}`,
    );
  }
}

// ---- main -----------------------------------------------------------------
(async () => {
  // Command and its argument come first; flags follow (as in asc.mjs).
  const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
  const arg = argv[1] && !argv[1].startsWith('--') ? argv[1] : undefined;
  const k = JSON.parse(fs.readFileSync(OPTS.keyPath, 'utf8'));
  if (!k.key_id || !k.issuer_id || !k.key)
    throw new Error(`Key JSON missing key_id/issuer_id/key: ${OPTS.keyPath}`);
  TOKEN = mintToken(k);
  const appId = await resolveAppId();

  if (command === 'setup') return setup(appId);
  if (command === 'status') return status(appId);
  if (command === 'screenshot') return screenshot(appId, arg);
  console.error('usage: asc-tips.mjs <setup|status|screenshot <png>>');
  process.exitCode = 1;
})().catch(e => {
  console.error('ERROR', e.message);
  process.exit(1);
});
