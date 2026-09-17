#!/usr/bin/env node
/**
 * Kiroku tip-jar in-app purchases: create and inspect them in App Store
 * Connect (zero-dependency, same auth as scripts/asc.mjs).
 *
 * The products are defined here, once, and must stay in step with
 * CONST.TIPS.PRODUCT_IDS in src/CONST.ts, because StoreKit silently omits any
 * id it does not recognize. scripts/play.mjs imports TIPS to create the same
 * products on Google Play, so this table is the copy for both stores. The
 * manual half of the setup (agreements, banking, submission) is in
 * contributingGuides/TIP_JAR.md.
 *
 * Usage:
 *   node scripts/asc-tips.mjs status
 *   node scripts/asc-tips.mjs setup
 *   node scripts/asc-tips.mjs copy [--yes]
 *   node scripts/asc-tips.mjs screenshot <path-to-png> [--yes]
 *
 * Every command is idempotent: `setup` skips what already exists, so it is
 * safe to re-run after a failure partway through. Transient 5xx responses are
 * retried.
 *
 * `copy` is the one that changes text on products that already exist: it
 * PATCHes the reference name and the localized name and description to match
 * the table below. A localization change goes to App Review with the old text
 * still live, so `copy` is a DRY RUN unless --yes.
 *
 * `screenshot` writes to all three products and deletes whatever is live on
 * them first, so it is a DRY RUN unless --yes.
 *
 * Flags:
 *   --bundle-id <id>   app bundle id (default: com.kiroku.app)
 *   --app-id <id>      ASC app id (skips the bundle-id lookup)
 *   --key <path>       ASC API key JSON (default: <repo>/ios/ios-fastlane-json-key.json)
 *   --yes              copy / screenshot: actually write (otherwise dry run)
 */
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://api.appstoreconnect.apple.com';
const DEFAULT_BUNDLE_ID = 'com.kiroku.app';
const L = (s = '') => console.log(s);

// Apple's limits: reference name 64 chars, localization name 30, description 45.
const REVIEW_NOTE =
  'Optional tip. It unlocks no features, content, or functionality: the app ' +
  'behaves identically whether or not a tip is ever given, and no part of ' +
  'the app is gated. Consumable so it can be given more than once; there is ' +
  'nothing to restore. To see it: Settings > Support Kiroku.';

// Base prices are CZK in the CZE territory; Apple derives every other
// territory from them (and Play every other region, see scripts/play.mjs).
// Must stay in step with CONST.TIPS.PRODUCT_IDS. The module's default export.
const TIPS = [
  {
    productId: 'kiroku.tipjar.small_beer',
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
  // The id says pint and the copy says beer on purpose: ids are burn-once, and
  // the middle tier was renamed to match the app's own drink vocabulary (a
  // 500 ml beer is `beer` in CONST.DRINK_DEFAULTS, not a pint). Nothing a user
  // sees carries the id.
  {
    productId: 'kiroku.tipjar.pint',
    name: 'Tip: beer',
    czk: 99,
    locales: {
      'en-US': {
        name: 'A beer',
        description: 'A thank-you beer. Unlocks nothing.',
      },
      cs: {
        name: 'Velké pivo',
        description: 'Velké pivo jako poděkování. Nic neodemyká.',
      },
    },
  },
  {
    productId: 'kiroku.tipjar.round',
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

// Apple rejects an over-long name or description with a generic 400, so check
// the table itself before any command touches the API.
for (const tip of TIPS) {
  for (const [locale, copy] of Object.entries(tip.locales)) {
    if (copy.name.length > 30 || copy.description.length > 45)
      throw new Error(
        `${tip.productId} ${locale}: name must be <= 30 chars (is ` +
          `${copy.name.length}) and description <= 45 (is ` +
          `${copy.description.length})`,
      );
  }
}

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
  yes: argv.includes('--yes'),
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
  const have = new Map(current.data.map(l => [l.attributes.locale, l]));
  for (const [locale, copy] of Object.entries(tip.locales)) {
    const live = have.get(locale);
    if (live) {
      // Creating is all `setup` does: changing live copy is a submission to
      // App Review, which belongs behind its own command.
      if (
        live.attributes.name !== copy.name ||
        live.attributes.description !== copy.description
      )
        L(
          `  ${locale} differs from the table; run \`asc-tips.mjs copy\` to see it`,
        );
      continue;
    }
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

// An in-app purchase's localized copy belongs to a *version*, not to the
// product: the live version is read-only, so changing the copy of an approved
// product means a new version that goes through App Review on its own while
// the live one keeps selling. These are the version states `copy` can edit,
// and the ones where it has to wait.
const EDITABLE_VERSION = new Set([
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_ACTION_NEEDED',
  'REJECTED',
]);
const VERSION_WITH_REVIEW = new Set(['WAITING_FOR_REVIEW', 'IN_REVIEW']);

/** Every version of a product, newest first. */
async function versionsOf(iapId) {
  const r = await api('GET', `/v2/inAppPurchases/${iapId}/versions?limit=20`);
  return r.data.sort((a, b) => b.attributes.version - a.attributes.version);
}

async function localizationsOf(versionId) {
  const r = await api(
    'GET',
    `/v1/inAppPurchaseVersions/${versionId}/localizations?limit=50`,
  );
  return r.data;
}

async function createLocalization(iapId, locale, copy) {
  await api('POST', '/v1/inAppPurchaseLocalizations', {
    data: {
      type: 'inAppPurchaseLocalizations',
      attributes: {locale, name: copy.name, description: copy.description},
      relationships: {
        inAppPurchaseV2: {data: {type: 'inAppPurchases', id: iapId}},
      },
    },
  });
}

/** The locales where a version's copy differs from the table. */
function localeDrift(tip, localizations) {
  const drift = [];
  for (const [locale, copy] of Object.entries(tip.locales)) {
    const live = localizations.find(l => l.attributes.locale === locale);
    if (
      !live ||
      live.attributes.name !== copy.name ||
      live.attributes.description !== copy.description
    )
      drift.push({locale, copy, live});
  }
  return drift;
}

/**
 * Write one product's drifted locales onto an editable version, opening one
 * first if the newest version is live, then send it to App Review.
 */
async function applyCopy(iap, tip, latest, drift) {
  let editable = EDITABLE_VERSION.has(latest.attributes.state) ? latest : null;
  let todo = drift;
  if (!editable) {
    // Creating a localization on a product whose newest version is live opens
    // the next version, and Apple copies the other locales into it as they
    // stand. So the first locale is a create, and the rest are edits.
    await createLocalization(iap.id, todo[0].locale, todo[0].copy);
    L(`  ${todo[0].locale} written`);
    todo = todo.slice(1);
    editable = (await versionsOf(iap.id))[0];
    L(`  version ${editable.attributes.version} opened`);
  }
  const localizations = await localizationsOf(editable.id);
  for (const {locale, copy} of todo) {
    const live = localizations.find(l => l.attributes.locale === locale);
    if (live)
      await api('PATCH', `/v1/inAppPurchaseLocalizations/${live.id}`, {
        data: {
          type: 'inAppPurchaseLocalizations',
          id: live.id,
          attributes: {name: copy.name, description: copy.description},
        },
      });
    else await createLocalization(iap.id, locale, copy);
    L(`  ${locale} written`);
  }
  await api('POST', '/v1/inAppPurchaseSubmissions', {
    data: {
      type: 'inAppPurchaseSubmissions',
      relationships: {
        inAppPurchaseV2: {data: {type: 'inAppPurchases', id: iap.id}},
      },
    },
  });
  L(`  version ${editable.attributes.version} submitted to App Review`);
}

/**
 * Bring the store copy of existing products in step with the TIPS table.
 * `setup` only ever creates, so renaming a tier needs this.
 *
 * The reference name is internal to App Store Connect and changes at once.
 * The localized name and description go to App Review as a new version: the
 * live text stays up until it is approved, the product stays on sale, and the
 * version can be deleted while it waits. Because it is a submission, this is
 * a DRY RUN unless --yes.
 */
async function syncCopy(appId) {
  const existing = await productsById(appId);
  let changes = 0;
  for (const tip of TIPS) {
    L(`\n${tip.productId}`);
    const iap = existing.get(tip.productId);
    if (!iap) {
      L('  NOT CREATED; run setup first');
      continue;
    }

    if (iap.attributes.name !== tip.name) {
      changes++;
      L(`  reference name: ${iap.attributes.name} -> ${tip.name}`);
      if (OPTS.yes) {
        await api('PATCH', `/v2/inAppPurchases/${iap.id}`, {
          data: {
            type: 'inAppPurchases',
            id: iap.id,
            attributes: {name: tip.name},
          },
        });
        L('  reference name written');
      }
    }

    const latest = (await versionsOf(iap.id))[0];
    const where = `version ${latest.attributes.version} (${latest.attributes.state})`;
    const drift = localeDrift(tip, await localizationsOf(latest.id));
    if (!drift.length) {
      L(`  copy matches the table in ${where}`);
      continue;
    }
    changes += drift.length;
    for (const {locale, copy, live} of drift) {
      const from = live
        ? `${live.attributes.name} / ${live.attributes.description}`
        : '(not localized)';
      L(`  ${locale}: ${from}`);
      L(
        `  ${' '.repeat(locale.length)}  -> ${copy.name} / ${copy.description}`,
      );
    }
    if (VERSION_WITH_REVIEW.has(latest.attributes.state)) {
      L(`  ${where} is with App Review; it cannot be changed until that ends`);
      continue;
    }
    if (!OPTS.yes) {
      L(
        EDITABLE_VERSION.has(latest.attributes.state)
          ? `  would write this into ${where} and submit it`
          : `  would open version ${latest.attributes.version + 1} with this copy and submit it`,
      );
      continue;
    }
    await applyCopy(iap, tip, latest, drift);
  }
  if (!changes) {
    L('\nStore copy already matches the table in this file.');
    return;
  }
  L(
    OPTS.yes
      ? '\nApp Review has to approve a localization change before it goes live. ' +
          'Play needs the same rename: node scripts/play.mjs tips --yes'
      : `\nDry run: ${changes} change(s). Re-run with --yes to send them.`,
  );
}

async function status(appId) {
  const existing = await productsById(appId);
  for (const tip of TIPS) {
    const iap = existing.get(tip.productId);
    if (!iap) {
      L(`${tip.productId}  NOT CREATED`);
      continue;
    }
    // Locales come from the newest version, not from the product: the
    // product-level list flattens every version, so a pending copy change
    // shows each locale twice.
    const [latest, manual, availability, shot] = await Promise.all([
      versionsOf(iap.id).then(v => v[0]),
      api(
        'GET',
        `/v1/inAppPurchasePriceSchedules/${iap.id}/manualPrices?include=inAppPurchasePricePoint&limit=10`,
      ),
      optional(`/v2/inAppPurchases/${iap.id}/inAppPurchaseAvailability`),
      optional(`/v2/inAppPurchases/${iap.id}/appStoreReviewScreenshot`),
    ]);
    const price = manual.included?.[0]?.attributes;
    const locales = (await localizationsOf(latest.id)).map(
      l => l.attributes.locale,
    );
    L(`\n${tip.productId}  [${iap.attributes.state}]`);
    L(`  type        : ${iap.attributes.inAppPurchaseType}`);
    L(
      `  copy        : version ${latest.attributes.version} (${latest.attributes.state})`,
    );
    L(
      `  price       : ${price ? `${price.customerPrice} (CZE base)` : 'NOT SET'}`,
    );
    L(`  locales     : ${locales.join(', ') || 'NONE'}`);
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

/**
 * Upload one PNG as the review screenshot for every tip product. Replacing a
 * screenshot deletes the live one first and the same image lands on all three
 * products, so this is a DRY RUN unless --yes: it reports the resize, what is
 * currently set, and what it would replace.
 */
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

  if (!OPTS.yes) {
    L('');
    for (const tip of TIPS) {
      const iap = existing.get(tip.productId);
      if (!iap) throw new Error(`${tip.productId} not created yet; run setup`);
      const current = await optional(
        `/v2/inAppPurchases/${iap.id}/appStoreReviewScreenshot`,
      );
      const live = current?.data
        ? `replacing ${current.data.attributes.fileName} ` +
          `(${current.data.attributes.assetDeliveryState?.state})`
        : 'no screenshot set';
      L(`${tip.productId}  [${iap.attributes.state}]  ${live}`);
    }
    L(`\nWould upload ${fileName} (${fileSize} bytes) to all ${TIPS.length}.`);
    L('DRY RUN. Pass --yes to write to App Store Connect.');
    return;
  }

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
async function main() {
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
  if (command === 'copy') return syncCopy(appId);
  if (command === 'screenshot') return screenshot(appId, arg);
  console.error(
    'usage: asc-tips.mjs <setup|status|copy [--yes]|screenshot <png> [--yes]> ' +
      '[--app-id <id>]',
  );
  process.exitCode = 1;
}

export default TIPS;

// Only as a CLI: scripts/play.mjs imports TIPS from this file.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch(e => {
    console.error('ERROR', e.message);
    process.exit(1);
  });
}
