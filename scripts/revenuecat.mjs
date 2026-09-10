#!/usr/bin/env node
/**
 * Kiroku RevenueCat dashboard state: inspect it, point the iOS app at the
 * right bundle id, and register the tip-jar products on the iOS and Android
 * apps (zero-dependency, v2 REST API).
 *
 * Everything here was dashboard-only clicking before, which is why
 * contributingGuides/BUNDLE_ID_MIGRATION.md still describes it that way in
 * places. The product ids are NOT defined in this file: they are read out of
 * src/CONST.ts, because StoreKit silently omits any id the app does not ask
 * for and a second copy of the list is a second chance to drift.
 *
 * Usage:
 *   node scripts/revenuecat.mjs status
 *   node scripts/revenuecat.mjs set-bundle-id <bundle-id> [--yes]
 *   node scripts/revenuecat.mjs setup [--yes]
 *
 * `status` is read-only. The other two are DRY RUNS unless --yes: they print
 * exactly what they would change first. `setup` is idempotent, so it is safe
 * to re-run after a failure partway through. `status` and `setup` cover both
 * store apps (app_store and play_store); `set-bundle-id` only the iOS one.
 *
 * Auth: a RevenueCat v2 secret key (sk_...), needed for every command. Taken
 * from $REVENUECAT_V2_SECRET_KEY, or from a gitignored .env.revenuecat (in
 * the repo root or --env-dir) holding REVENUECAT_V2_SECRET_KEY=sk_... . It
 * is never printed.
 *
 * Flags:
 *   --env-dir <dir>  where the .env.* files live (default: repo root; a git
 *                    worktree has none, so point it at the main checkout)
 *   --project <id>   RevenueCat project id (default: the only one, or $REVENUECAT_PROJECT_ID)
 *   --app <id>       RevenueCat app id (default: the single app_store app, plus
 *                    the single play_store app for status and setup)
 *   --yes            actually write (otherwise dry run)
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://api.revenuecat.com/v2';
const L = (s = '') => console.log(s);

const argv = process.argv.slice(2);
function flag(name, def) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const OPTS = {
  envDir: flag('env-dir', process.env.REVENUECAT_ENV_DIR || ROOT),
  projectId: flag('project', process.env.REVENUECAT_PROJECT_ID),
  appId: flag('app', process.env.REVENUECAT_APP_ID),
  yes: argv.includes('--yes'),
};

/** Reads KEY=value out of a dotenv-style file. Returns {} if absent. */
function dotenv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

let SECRET;
function secretKey() {
  if (SECRET) return SECRET;
  const key =
    process.env.REVENUECAT_V2_SECRET_KEY ||
    dotenv(path.join(ROOT, '.env.revenuecat')).REVENUECAT_V2_SECRET_KEY ||
    dotenv(path.join(OPTS.envDir, '.env.revenuecat')).REVENUECAT_V2_SECRET_KEY;
  if (!key) {
    throw new Error(
      'No RevenueCat secret key. Set $REVENUECAT_V2_SECRET_KEY, or put\n' +
        'REVENUECAT_V2_SECRET_KEY=sk_... in .env.revenuecat at the repo root\n' +
        'or in --env-dir (gitignored by the *.env* rule). Never commit it.',
    );
  }
  SECRET = key;
  return key;
}

/** sk_xxxxYYYY -> sk_xxxx…YYYY, so logs can name a key without leaking it. */
const mask = k => (k.length > 12 ? `${k.slice(0, 8)}…${k.slice(-4)}` : '…');

async function api(method, p, body) {
  const url = p.startsWith('http') ? p : BASE + p;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
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
    if ((res.status >= 500 || res.status === 429) && attempt < 3) {
      await new Promise(resolve => {
        setTimeout(resolve, 1000 * attempt);
      });
      continue;
    }
    const err = new Error(
      `HTTP ${res.status} ${method} ${url}\n${JSON.stringify(parsed, null, 2)}`,
    );
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
}

/** Follows `next_page` so a short first page never reads as "not there". */
async function list(p) {
  const items = [];
  let next = p;
  while (next) {
    const page = await api('GET', next);
    items.push(...(page.items ?? []));
    next = page.next_page ?? null;
  }
  return items;
}

// ---- the contract with the app -------------------------------------------

/**
 * The tip product ids, read from src/CONST.ts rather than repeated here. If
 * this throws, the constant moved: fix the reader, do not paste the ids in.
 */
function tipProductIds() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'CONST.ts'), 'utf8');
  const block = /TIPS:\s*{\s*PRODUCT_IDS:\s*\[([^\]]*)\]/.exec(src);
  if (!block) {
    throw new Error('Could not find CONST.TIPS.PRODUCT_IDS in src/CONST.ts');
  }
  const ids = [...block[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
  if (!ids.length) {
    throw new Error('CONST.TIPS.PRODUCT_IDS is empty in src/CONST.ts');
  }
  return ids;
}

/**
 * The store apps the tip jar sells on, and the .env.* variable holding each
 * one's public SDK key.
 */
const TIP_STORES = {
  app_store: 'REVENUECAT_IOS_API_KEY',
  play_store: 'REVENUECAT_ANDROID_API_KEY',
};

/** The public SDK keys the shipped binaries actually use, per .env.* file. */
function envPublicKeys(variable) {
  if (!fs.existsSync(OPTS.envDir)) return [];
  return fs
    .readdirSync(OPTS.envDir)
    .filter(f => /^\.env\./.test(f) && !/example|revenuecat/.test(f))
    .map(f => ({
      file: f,
      key: dotenv(path.join(OPTS.envDir, f))[variable] || '',
    }))
    .filter(e => e.key);
}

// ---- resolution -----------------------------------------------------------

// v2 has no GET /projects/{id}: the list endpoint is the only way to read one.
async function findProject(projectId) {
  const projects = await list('/projects');
  return (
    projects.find(p => p.id === projectId) ?? {id: projectId, name: '(unknown)'}
  );
}

async function resolveProject() {
  if (OPTS.projectId) return OPTS.projectId;
  const projects = await list('/projects');
  if (projects.length !== 1) {
    const listed = projects.map(p => `  ${p.id}  ${p.name}`).join('\n');
    throw new Error(
      `Expected exactly one project, found ${projects.length}. Pass --project <id>:\n${listed}`,
    );
  }
  return projects[0].id;
}

async function resolveApp(projectId) {
  const apps = await list(`/projects/${projectId}/apps`);
  if (OPTS.appId) {
    const found = apps.find(a => a.id === OPTS.appId);
    if (!found) throw new Error(`No app ${OPTS.appId} in project ${projectId}`);
    return {app: found, apps};
  }
  const ios = apps.filter(a => a.type === 'app_store');
  if (ios.length !== 1) {
    const listed = apps.map(a => `  ${a.id}  ${a.type}  ${a.name}`).join('\n');
    throw new Error(
      `Expected exactly one app_store app, found ${ios.length}. Pass --app <id>:\n${listed}`,
    );
  }
  return {app: ios[0], apps};
}

/** The apps the tip products belong on: one per store in TIP_STORES. */
function tipApps(apps) {
  if (OPTS.appId) {
    const found = apps.find(a => a.id === OPTS.appId);
    if (!found) throw new Error(`No app ${OPTS.appId} in this project`);
    return [found];
  }
  return Object.keys(TIP_STORES).map(type => {
    const matches = apps.filter(a => a.type === type);
    if (matches.length !== 1) {
      const listed = apps
        .map(a => `  ${a.id}  ${a.type}  ${a.name}`)
        .join('\n');
      throw new Error(
        `Expected exactly one ${type} app, found ${matches.length}. Pass --app <id>:\n${listed}`,
      );
    }
    return matches[0];
  });
}

const storeId = app =>
  app.app_store?.bundle_id ??
  app.play_store?.package_name ??
  app.amazon?.package_name ??
  app.stripe?.stripe_account_id ??
  '(none)';

// ---- commands -------------------------------------------------------------

async function status() {
  const projectId = await resolveProject();
  const project = await findProject(projectId);
  L(`Project  ${project.name}  (${projectId})`);
  L(`Key      ${mask(secretKey())}`);
  L();

  const apps = await list(`/projects/${projectId}/apps`);
  L('Apps');
  for (const app of apps) {
    L(`  ${app.name}  [${app.type}]  ${app.id}`);
    L(`    store id: ${storeId(app)}`);
    if (TIP_STORES[app.type]) {
      const keys = await list(
        `/projects/${projectId}/apps/${app.id}/public_api_keys`,
      );
      const envs = envPublicKeys(TIP_STORES[app.type]);
      for (const k of keys) {
        const used = envs.filter(e => e.key === k.key).map(e => e.file);
        let match = '';
        if (envs.length) {
          match = used.length
            ? `  <- used by ${used.join(', ')}`
            : '  <- not in any .env.*';
        }
        L(
          `    public key (${k.environment ?? 'production'}): ${mask(k.key)}${match}`,
        );
      }
      if (!envs.length) {
        L('    (no .env.* files here, so no key match was checked)');
      }
    }
  }
  L();

  const wanted = tipProductIds();
  const products = await list(`/projects/${projectId}/products`);
  L(`Products (${products.length} in project)`);
  for (const p of products) {
    const app = apps.find(a => a.id === p.app_id);
    const name = p.display_name ? `  "${p.display_name}"` : '';
    L(
      `  ${p.store_identifier}  [${p.type}]  app=${app ? app.name : p.app_id}${name}`,
    );
  }
  L();

  let missing = 0;
  for (const app of tipApps(apps)) {
    L(`Tip contract (CONST.TIPS.PRODUCT_IDS vs app "${app.name}")`);
    for (const id of wanted) {
      const hit = products.find(
        p => p.store_identifier === id && p.app_id === app.id,
      );
      if (hit) {
        L(`  OK       ${id}  [${hit.type}]`);
      } else {
        missing += 1;
        L(`  MISSING  ${id}`);
      }
    }
    L();
  }
  L(
    missing
      ? `${missing} product(s) to create: run setup`
      : 'All tip products registered.',
  );
}

async function setBundleId(bundleId) {
  if (!bundleId || bundleId.startsWith('--')) {
    throw new Error('Usage: set-bundle-id <bundle-id> [--yes]');
  }
  const projectId = await resolveProject();
  const {app} = await resolveApp(projectId);
  const current = app.app_store?.bundle_id ?? '(none)';
  L(`App      ${app.name}  (${app.id})`);
  L(`Bundle   ${current}  ->  ${bundleId}`);
  if (current === bundleId) {
    L('Already set. Nothing to do.');
    return;
  }
  if (!OPTS.yes) {
    L();
    L('Dry run. Re-run with --yes to apply.');
    return;
  }
  const updated = await api('POST', `/projects/${projectId}/apps/${app.id}`, {
    app_store: {bundle_id: bundleId},
  });
  const now = updated.app_store?.bundle_id ?? '(none)';
  L(`Now      ${now}`);
  if (now !== bundleId) {
    throw new Error(
      'The API accepted the call but the bundle id did not change. ' +
        'Treat the edit as unsupported and see BUNDLE_ID_MIGRATION.md section 5.',
    );
  }
  // The public SDK key belongs to the app, not the bundle id, so an edit
  // leaves every .env.* file and every *_ENV_FILE secret valid. Prove it
  // rather than asserting it.
  const keys = await list(
    `/projects/${projectId}/apps/${app.id}/public_api_keys`,
  );
  const envs = envPublicKeys();
  const stillGood = envs.every(e => keys.some(k => k.key === e.key));
  if (!envs.length) {
    L('(no .env.* files here to re-check)');
  } else if (stillGood) {
    L(
      'Public SDK key unchanged: .env.* files and *_ENV_FILE secrets stay valid.',
    );
  } else {
    L(
      'WARNING: no .env.* key matches this app any more. Check before shipping.',
    );
  }
}

async function setup() {
  const projectId = await resolveProject();
  const apps = await list(`/projects/${projectId}/apps`);
  const wanted = tipProductIds();
  const products = await list(`/projects/${projectId}/products`);

  L(`Project  ${projectId}`);
  const todo = [];
  for (const app of tipApps(apps)) {
    L();
    L(`App      ${app.name}  (${app.id})  ${storeId(app)}`);
    for (const id of wanted) {
      const hit = products.find(
        p => p.store_identifier === id && p.app_id === app.id,
      );
      if (hit) L(`  skip    ${id}  (already registered, ${hit.type})`);
      else {
        todo.push({app, id});
        L(`  create  ${id}  [consumable]`);
      }
    }
  }
  if (!todo.length) {
    L();
    L('Nothing to do.');
    return;
  }
  if (!OPTS.yes) {
    L();
    L('Dry run. Re-run with --yes to create.');
    return;
  }
  L();
  for (const {app, id} of todo) {
    // Consumable on Play too: RevenueCat consumes the purchase itself, which
    // is what lets Play sell the same tip again.
    const created = await api('POST', `/projects/${projectId}/products`, {
      store_identifier: id,
      app_id: app.id,
      type: 'consumable',
    });
    L(
      `  created ${created.store_identifier}  [${created.type}]  ${app.name}  ${created.id}`,
    );
  }
  L();
  L('Done. Re-run `status` to verify.');
}

// ---- entry ----------------------------------------------------------------

const [cmd, ...rest] = argv.filter(a => !a.startsWith('--'));
const run = {
  status,
  'set-bundle-id': () => setBundleId(rest[0]),
  setup,
}[cmd];

if (!run) {
  L('Usage:');
  L('  node scripts/revenuecat.mjs status');
  L('  node scripts/revenuecat.mjs set-bundle-id <bundle-id> [--yes]');
  L('  node scripts/revenuecat.mjs setup [--yes]');
  process.exit(cmd ? 1 : 0);
}

run().catch(e => {
  console.error(e.message);
  process.exit(1);
});
