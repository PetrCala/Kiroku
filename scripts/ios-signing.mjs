#!/usr/bin/env node
/**
 * Kiroku — iOS code-signing renewal (zero-dependency).
 *
 * iOS signing is manual (not fastlane match): GPG-AES256-encrypted assets
 * committed in ios/ and decrypted in CI with the LARGE_SECRET_PASSPHRASE
 * secret. The Apple Distribution certificate and the App Store / Ad-Hoc
 * provisioning profiles expire ~yearly; when they do, every iOS build breaks.
 *
 * This CLI regenerates them through the App Store Connect API (reusing the
 * existing fastlane API key — ios/ios-fastlane-json-key.json{,.gpg} — and the
 * same ES256 JWT minting as scripts/asc.mjs), rebuilds the P12, re-encrypts the
 * committed ios/*.gpg, and opens a PR. The irreversible steps (rotating the
 * IOS_CERTIFICATE_PASSWORD secret + revoking the old cert) are split into a
 * post-merge `finalize` so this is also safe to run proactively before expiry.
 *
 * It NEVER prints the API key, the GPG passphrase, or the new P12 password.
 * Requires Node 18+ (global fetch), OpenSSL 3.x (for the P12), gpg, and — for
 * the P12 verify + finalize — macOS `security` / `gh`. No npm dependencies.
 *
 * Usage:
 *   node scripts/ios-signing.mjs check  [--deep] [--days 21]
 *   node scripts/ios-signing.mjs renew  [--yes] [--p12 <path> --p12-password <pw>] [--profile-suffix .test]
 *   node scripts/ios-signing.mjs finalize [--yes]
 *
 * Commands:
 *   check    Report expiry + state for the Distribution cert and the Kiroku /
 *            Kiroku_AdHoc profiles via the ASC API. --deep also decrypts the
 *            committed ios/*.gpg and inspects the embedded certs (the authoritative
 *            "will CI build" verdict). Exits non-zero if expired or within --days.
 *   renew    DRY RUN unless --yes. Mints a new Distribution cert + the two
 *            CI-critical profiles, rebuilds Certificates.p12, re-encrypts the
 *            ios/*.gpg, commits on a new branch and opens a PR. Additive and
 *            reversible — never revokes, never rotates the secret.
 *   finalize DRY RUN unless --yes. POST-MERGE: rotates the IOS_CERTIFICATE_PASSWORD
 *            secret to the new P12 password and revokes the old expired cert /
 *            deletes the old profiles, then clears the scratch state.
 *
 * Flags:
 *   --yes               actually execute (renew/finalize are dry-run otherwise)
 *   --deep              check: also decrypt + inspect the committed ios/*.gpg
 *   --days <n>          check: warn/fail threshold in days (default 21)
 *   --key <path>        ASC API key JSON (default: ios/ios-fastlane-json-key.json, else the .gpg)
 *   --passphrase <p>    GPG passphrase (default: $LARGE_SECRET_PASSPHRASE)
 *   --p12 <path>        renew: bring-your-own .p12 (skips cert creation; for App-Manager-only keys)
 *   --p12-password <p>  password for --p12 (or, for check --deep, $IOS_CERTIFICATE_PASSWORD)
 *   --cert-type <t>     override the certificateType (default: detected, usually IOS_DISTRIBUTION)
 *   --revoke-cert <id>  renew: revoke this exact distribution cert first to free a cap slot (never automatic)
 *   --bundle-wwdr       renew: bundle the Apple WWDR G6 intermediate into the P12
 *   --profile-suffix <s> renew: append to profile names + write to scratch paths (end-to-end test; does NOT touch ios/*.gpg)
 *   --bundle-id <id>    app bundle id (default: org.reactjs.native.example.alcohol-tracker)
 *   --repo <owner/repo> GitHub repo for the PR + secret (default: PetrCala/Kiroku)
 *   --help, -h          show this help
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const IOS_DIR = path.join(ROOT, 'ios');
const BASE = 'https://api.appstoreconnect.apple.com';
const DEFAULT_BUNDLE_ID = 'org.reactjs.native.example.alcohol-tracker';
const STATE_FILE = path.join(IOS_DIR, '.signing-renew-state.json');
const KEY_PLAIN = path.join(IOS_DIR, 'ios-fastlane-json-key.json');
const KEY_GPG = path.join(IOS_DIR, 'ios-fastlane-json-key.json.gpg');
const P12_FILE = 'Certificates.p12';
// Apple WWDR G6 — the current intermediate for 2023+ Apple Distribution leaves.
const WWDR_URL = 'https://www.apple.com/certificateauthority/AppleWWDRCAG6.cer';

// The CI-critical profile set. Kiroku (platformDeploy.yml `beta`) and
// Kiroku_AdHoc (testBuild.yml `build_internal`) are bound BY NAME in the
// Fastfile export_options, so regenerated profiles MUST keep these names. Both
// are distribution-signed, so one new cert covers both. Dev/watch profiles are
// intentionally out of scope (not CI-consumed; dev needs a separate cert).
const PROFILES = [
  {
    name: 'Kiroku',
    file: 'Kiroku.mobileprovision',
    type: 'IOS_APP_STORE',
    devices: false,
  },
  {
    name: 'Kiroku_AdHoc',
    file: 'Kiroku_AdHoc.mobileprovision',
    type: 'IOS_APP_ADHOC',
    devices: true,
  },
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
  bundleId: flag('bundle-id', process.env.ASC_BUNDLE_ID || DEFAULT_BUNDLE_ID),
  keyPath: flag('key', process.env.ASC_KEY_JSON),
  passphrase: flag('passphrase', process.env.LARGE_SECRET_PASSPHRASE),
  days: Number(flag('days', 21)),
  certType: flag('cert-type'),
  revokeCert: flag('revoke-cert'),
  p12: flag('p12'),
  p12Password: flag('p12-password', process.env.IOS_CERTIFICATE_PASSWORD),
  profileSuffix: flag('profile-suffix', ''),
  repo: flag('repo', 'PetrCala/Kiroku'),
  deep: argv.includes('--deep'),
  bundleWwdr: argv.includes('--bundle-wwdr'),
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
// Kept intentionally in sync with scripts/asc.mjs — duplicated rather than
// shared so the release-critical asc.mjs is never coupled to this tool.
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
  if (!res.ok) {
    const err = new Error(
      `HTTP ${res.status} ${method} ${url}\n${JSON.stringify(parsed, null, 2)}`,
    );
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
}
// Follow `links.next` so we never silently cap a list at one page.
async function apiList(p) {
  let out = [];
  let next = p;
  while (next) {
    const r = await api('GET', next);
    out = out.concat(r.data || []);
    next = r.links && r.links.next ? r.links.next : null;
  }
  return out;
}

// ---- shell helpers --------------------------------------------------------
function run(bin, args, opts = {}) {
  const encoding = opts.encoding ?? 'utf8';
  let {input} = opts;
  // With a string `input` and encoding:'buffer', execFileSync would try
  // Buffer.from(input, 'buffer') → "Unknown encoding: buffer". Hand it a Buffer.
  if (encoding === 'buffer' && typeof input === 'string')
    input = Buffer.from(input);
  return execFileSync(bin, args, {
    encoding,
    input,
    env: opts.env ? {...process.env, ...opts.env} : process.env,
    stdio: opts.stdio ?? ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}
// Resolve an OpenSSL 3.x binary. The P12 must be written in the legacy
// PKCS#12 format (RC2/3DES + SHA-1 MAC) — empirically the only format macOS
// `security import` (the call fastlane runs in CI) accepts; modern
// PBES2/AES-256 P12s are rejected. OpenSSL 3's `-legacy` flag produces it
// (LibreSSL doesn't accept the flag), so the P12 step requires OpenSSL 3.x.
// This is safe: the P12 is GPG-AES256-encrypted at rest and is only a transient
// CI build artifact.
function resolveOpenssl3() {
  const candidates = [
    process.env.OPENSSL3_BIN,
    '/opt/homebrew/opt/openssl@3/bin/openssl',
    '/usr/local/opt/openssl@3/bin/openssl',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (run(c, ['version']).startsWith('OpenSSL 3')) return c;
    } catch {
      /* try next */
    }
  }
  try {
    if (run('openssl', ['version']).startsWith('OpenSSL 3')) return 'openssl';
  } catch {
    /* fall through */
  }
  return null;
}
const OPENSSL3 = resolveOpenssl3();
function requireOpenssl3() {
  if (!OPENSSL3)
    throw new Error(
      'OpenSSL 3.x is required for the P12 step (LibreSSL on PATH is not supported). Install with: brew install openssl@3',
    );
  return OPENSSL3;
}
const openssl = (args, opts) => run(OPENSSL3 || 'openssl', args, opts);

let tmpRoot;
function tmpDir() {
  if (!tmpRoot)
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kiroku-signing-'));
  return tmpRoot;
}
function tmpFile(name) {
  return path.join(tmpDir(), name);
}
function cleanupTmp() {
  if (tmpRoot) fs.rmSync(tmpRoot, {recursive: true, force: true});
}

// ---- gpg ------------------------------------------------------------------
function requirePassphrase(reason) {
  if (!OPTS.passphrase)
    throw new Error(
      `Need the GPG passphrase to ${reason}. Set LARGE_SECRET_PASSPHRASE or pass --passphrase.`,
    );
}
function gpgDecrypt(gpgPath) {
  requirePassphrase(`decrypt ${path.basename(gpgPath)}`);
  return run(
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
    {
      input: OPTS.passphrase,
      encoding: 'buffer',
    },
  );
}
// Mirrors scripts/encrypt.sh (AES256 symmetric) so CI's gpg --decrypt works
// unchanged; overwrites the .gpg (encrypt.sh refuses to). Passphrase via fd 0
// to keep it out of argv/ps.
function gpgEncryptOverwrite(plainPath) {
  requirePassphrase(`encrypt ${path.basename(plainPath)}`);
  run(
    'gpg',
    [
      '--batch',
      '--yes',
      '--pinentry-mode',
      'loopback',
      '--passphrase-fd',
      '0',
      '--symmetric',
      '--cipher-algo',
      'AES256',
      '--output',
      `${plainPath}.gpg`,
      plainPath,
    ],
    {
      input: OPTS.passphrase,
    },
  );
}

// ---- scratch state --------------------------------------------------------
// Module-level so the renew helpers mutate one shared object (avoids threading
// + reassigning a `state` parameter through every step).
let STATE = {};
function loadState() {
  try {
    STATE = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    STATE = {};
  }
  return STATE;
}
function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(STATE, null, 2), {mode: 0o600});
}
function clearState() {
  STATE = {};
  fs.rmSync(STATE_FILE, {force: true});
}

// ---- key loading ----------------------------------------------------------
function loadKey() {
  let raw;
  if (OPTS.keyPath && fs.existsSync(OPTS.keyPath))
    raw = fs.readFileSync(OPTS.keyPath, 'utf8');
  else if (fs.existsSync(KEY_PLAIN)) raw = fs.readFileSync(KEY_PLAIN, 'utf8');
  else if (fs.existsSync(KEY_GPG)) raw = gpgDecrypt(KEY_GPG).toString('utf8');
  else
    throw new Error(
      'No ASC API key found (--key, ios/ios-fastlane-json-key.json, or its .gpg).',
    );
  const k = JSON.parse(raw);
  if (!k.key_id || !k.issuer_id || !k.key)
    throw new Error('ASC key JSON missing key_id/issuer_id/key.');
  return k;
}

// ---- ASC resources --------------------------------------------------------
const isDistribution = c =>
  /DISTRIBUTION/.test(c.attributes.certificateType || '');
async function listDistributionCerts() {
  return (await apiList('/v1/certificates?limit=200')).filter(isDistribution);
}
async function listManagedProfiles() {
  const all = await apiList('/v1/profiles?limit=200');
  const wanted = PROFILES.map(p => p.name + OPTS.profileSuffix);
  return all.filter(p => wanted.includes(p.attributes.name));
}
async function resolveBundleResourceId() {
  const ids = await apiList(
    `/v1/bundleIds?filter[identifier]=${encodeURIComponent(OPTS.bundleId)}&limit=200`,
  );
  const exact = ids.find(b => b.attributes.identifier === OPTS.bundleId);
  if (!exact)
    throw new Error(
      `No bundleId resource matching ${OPTS.bundleId} (found: ${ids.map(b => b.attributes.identifier).join(', ') || 'none'})`,
    );
  return exact.id;
}
async function listEnabledDeviceIds() {
  return (await apiList('/v1/devices?filter[status]=ENABLED&limit=200')).map(
    d => d.id,
  );
}

// ---- cert / profile inspection (no Apple call) ---------------------------
const daysUntil = d =>
  Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
function x509(input) {
  const c = new crypto.X509Certificate(input);
  return {notAfter: c.validTo, serial: c.serialNumber, subject: c.subject};
}
// Decode a .mobileprovision (CMS) → its embedded plist via macOS security, then
// pull fields with `plutil -extract` (not `-convert json`, which rejects the
// plist's <date>/<data> nodes).
function readProfile(mpPath) {
  const xml = run('security', ['cms', '-D', '-i', mpPath]);
  const pl = tmpFile('profile.plist');
  fs.writeFileSync(pl, xml);
  const extract = key => {
    try {
      return run('plutil', ['-extract', key, 'raw', '-o', '-', pl]).trim();
    } catch {
      return null;
    }
  };
  const certs = [];
  for (let i = 0; ; i++) {
    const b64 = extract(`DeveloperCertificates.${i}`);
    if (!b64) break;
    certs.push(x509(Buffer.from(b64, 'base64')));
  }
  return {
    name: extract('Name'),
    uuid: extract('UUID'),
    expirationDate: extract('ExpirationDate'),
    certs,
  };
}

// ===========================================================================
// check
// ===========================================================================
async function cmdCheck() {
  let bad = false;
  const classify = date => {
    const d = daysUntil(date);
    if (d < 0) return {tag: '✗ EXPIRED', expiring: true};
    if (d <= OPTS.days) return {tag: `⚠ ${d}d`, expiring: true};
    return {tag: `✓ ${d}d`, expiring: false};
  };
  const flagDays = (label, date, extra) => {
    const {tag, expiring} = classify(date);
    if (expiring) bad = true;
    L(
      `  ${label}: ${tag} (until ${new Date(date).toISOString().slice(0, 10)}${extra ? `, ${extra}` : ''})`,
    );
  };

  L('PORTAL (App Store Connect API):');
  const certs = await listDistributionCerts();
  if (!certs.length) {
    L('  Distribution cert: ✗ NONE on the account');
    bad = true;
  } else {
    certs.forEach(c =>
      flagDays(
        `Distribution cert ${c.attributes.certificateType} ${c.id}`,
        c.attributes.expirationDate,
      ),
    );
  }
  const profiles = await listManagedProfiles();
  for (const want of PROFILES) {
    const name = want.name + OPTS.profileSuffix;
    const p = profiles.find(x => x.attributes.name === name);
    if (!p) {
      L(`  Profile ${name}: ✗ NONE`);
      bad = true;
    } else {
      flagDays(
        `Profile ${name}`,
        p.attributes.expirationDate,
        p.attributes.profileState,
      );
    }
  }

  // --deep (or auto when the passphrase is available): the committed .gpg is
  // what CI actually consumes; the portal can be green while a stale asset
  // still breaks the build.
  if (OPTS.deep || OPTS.passphrase) {
    L('\nCOMMITTED ASSETS (decrypted ios/*.gpg — what CI builds with):');
    for (const want of PROFILES) {
      const gpg = path.join(IOS_DIR, `${want.file}.gpg`);
      if (!fs.existsSync(gpg)) {
        L(`  ${want.file}: (no .gpg committed)`);
        continue;
      }
      const mp = tmpFile(want.file);
      fs.writeFileSync(mp, gpgDecrypt(gpg));
      const info = readProfile(mp);
      flagDays(`${want.file} [${info.name}]`, info.expirationDate);
      info.certs.forEach((c, i) =>
        flagDays(
          `  └ embedded cert ${i} (${c.subject.split('\n')[0]})`,
          c.notAfter,
        ),
      );
      fs.rmSync(mp, {force: true});
    }
    L('  (the embedded cert expiry above is the true CI signing constraint)');
  } else {
    L(
      '\n(run with --deep, or set LARGE_SECRET_PASSPHRASE, to inspect the committed ios/*.gpg)',
    );
  }

  L(
    bad
      ? '\nRESULT: action needed — something is expired or within the threshold.'
      : '\nRESULT: all green ✓',
  );
  process.exitCode = bad ? 1 : 0;
}

// ===========================================================================
// renew
// ===========================================================================
function ensureGitReady() {
  // Only require a clean tree. Running from master is fine — renew always cuts
  // its own automation/* branch (below) and never commits to or pushes master.
  const dirty = run('git', ['-C', ROOT, 'status', '--porcelain']).trim();
  if (dirty)
    throw new Error(
      `Working tree is not clean — commit/stash first:\n${dirty}`,
    );
}

async function ensureCertificate(bundleHint) {
  // Resume: reuse an in-flight cert from a previous interrupted run.
  if (STATE.newCert && STATE.privateKeyPem && STATE.certPem) {
    const still = await api(
      'GET',
      `/v1/certificates/${STATE.newCert.id}`,
    ).catch(() => null);
    if (still) {
      L(
        `Resuming with in-flight cert ${STATE.newCert.id} from a previous run.`,
      );
      return;
    }
  }
  // BYO-cert: an externally created P12 (covers an App-Manager-only API key).
  if (OPTS.p12) {
    if (!OPTS.p12Password) throw new Error('--p12 requires --p12-password.');
    STATE.byoP12 = {path: path.resolve(OPTS.p12), password: OPTS.p12Password};
    saveState();
    return;
  }

  // Free a cap slot by revoking the exact cert the operator named. Guarded:
  // only ever revokes that one id (validated as a current distribution cert),
  // never picks a valid cert to revoke on its own.
  if (OPTS.revokeCert && !STATE.revokedForSlot) {
    const target = (await listDistributionCerts()).find(
      c => c.id === OPTS.revokeCert,
    );
    if (!target)
      throw new Error(
        `--revoke-cert ${OPTS.revokeCert} is not a current distribution certificate.`,
      );
    await api('DELETE', `/v1/certificates/${OPTS.revokeCert}`);
    STATE.revokedForSlot = OPTS.revokeCert;
    saveState();
    L(`Revoked cert ${OPTS.revokeCert} to free a cap slot.`);
  }

  const certType = OPTS.certType || STATE.certType;
  const keyPath = tmpFile('signing.key');
  const csrPath = tmpFile('signing.csr');
  openssl([
    'req',
    '-new',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    keyPath,
    '-out',
    csrPath,
    '-subj',
    `/CN=Kiroku ${certType}/O=${bundleHint}`,
  ]);
  STATE.privateKeyPem = fs.readFileSync(keyPath, 'utf8');
  saveState(); // persist the key BEFORE the cert exists, so a retry can resume
  const csrContent = fs.readFileSync(csrPath, 'utf8');

  let created;
  try {
    created = await api('POST', '/v1/certificates', {
      data: {
        type: 'certificates',
        attributes: {certificateType: certType, csrContent},
      },
    });
  } catch (e) {
    if (e.status === 403)
      throw new Error(
        'ASC API key lacks Admin rights — certificate creation requires the Admin role.\nElevate the key in ASC → Users and Access → Integrations, or use the --p12 bring-your-own-cert path.',
      );
    if (
      e.status === 409 ||
      /maximum number of certificates/i.test(JSON.stringify(e.body || ''))
    ) {
      const expired = (await listDistributionCerts()).filter(
        c => daysUntil(c.attributes.expirationDate) < 0,
      );
      if (!expired.length)
        throw new Error(
          'At the certificate cap and no expired certificate to free a slot. Revoke a cert manually (never auto-revoke a valid one), then re-run.',
        );
      L(
        `At the cert cap — revoking the EXPIRED cert ${expired[0].id} to free a slot.`,
      );
      await api('DELETE', `/v1/certificates/${expired[0].id}`);
      created = await api('POST', '/v1/certificates', {
        data: {
          type: 'certificates',
          attributes: {certificateType: certType, csrContent},
        },
      });
    } else throw e;
  }
  STATE.newCert = {
    id: created.data.id,
    type: created.data.attributes.certificateType,
    serial: created.data.attributes.serialNumber,
    expirationDate: created.data.attributes.expirationDate,
  };
  STATE.certPem = run(OPENSSL3 || 'openssl', ['x509', '-inform', 'DER'], {
    input: Buffer.from(created.data.attributes.certificateContent, 'base64'),
  });
  saveState();
  L(
    `Created cert ${STATE.newCert.id} (${STATE.newCert.type}), expires ${STATE.newCert.expirationDate}.`,
  );
}

function buildAndVerifyP12() {
  if (STATE.byoP12) return STATE.byoP12; // already a usable P12
  requireOpenssl3();
  const keyPath = tmpFile('signing.key');
  const certPath = tmpFile('cert.pem');
  const p12Path = tmpFile(P12_FILE);
  fs.writeFileSync(keyPath, STATE.privateKeyPem);
  fs.writeFileSync(certPath, STATE.certPem);
  const password =
    STATE.p12Password || crypto.randomBytes(24).toString('base64url');
  STATE.p12Password = password;
  saveState();

  // `-legacy` → RC2/3DES + SHA-1 MAC, the only PKCS#12 format macOS `security
  // import` accepts. See resolveOpenssl3() for why this is safe.
  const args = [
    'pkcs12',
    '-export',
    '-legacy',
    '-inkey',
    keyPath,
    '-in',
    certPath,
    '-name',
    `Apple Distribution: Kiroku (${STATE.newCert?.type || 'cert'})`,
    '-passout',
    'env:P12PW',
    '-out',
    p12Path,
  ];
  if (OPTS.bundleWwdr) {
    const wwdr = tmpFile('wwdr.cer');
    run('curl', ['-fsSL', '-o', wwdr, WWDR_URL]);
    const wwdrPem = tmpFile('wwdr.pem');
    fs.writeFileSync(wwdrPem, openssl(['x509', '-inform', 'DER', '-in', wwdr]));
    args.splice(args.indexOf('-name'), 0, '-certfile', wwdrPem);
  }
  openssl(args, {env: {P12PW: password}});

  // Verify with the SAME `security import` fastlane runs in CI, in a throwaway keychain.
  const kc = tmpFile('verify.keychain-db');
  const kcPw = crypto.randomBytes(12).toString('hex');
  run('security', ['create-keychain', '-p', kcPw, kc]);
  try {
    run('security', [
      'import',
      p12Path,
      '-k',
      kc,
      '-P',
      password,
      '-T',
      '/usr/bin/codesign',
    ]);
    L('P12 verified via `security import` ✓');
  } finally {
    run('security', ['delete-keychain', kc]);
  }
  return {path: p12Path, password};
}

async function ensureProfiles(ctx) {
  STATE.profiles = STATE.profiles || {};
  STATE.oldProfiles = STATE.oldProfiles || {};
  const existing = await listManagedProfiles();
  for (const want of PROFILES) {
    const fullName = want.name + OPTS.profileSuffix;
    if (STATE.profiles[fullName]) {
      L(
        `Profile ${fullName} already created this run (${STATE.profiles[fullName].id}).`,
      );
      continue;
    }
    const old = existing.find(p => p.attributes.name === fullName);
    if (old) {
      STATE.oldProfiles[fullName] = old.id; // retained for finalize
      saveState();
    }
    const relationships = {
      bundleId: {data: {type: 'bundleIds', id: ctx.bundleResId}},
      certificates: {data: [{type: 'certificates', id: ctx.certId}]},
    };
    if (want.devices)
      relationships.devices = {
        data: ctx.deviceIds.map(id => ({type: 'devices', id})),
      };
    let res;
    try {
      res = await api('POST', '/v1/profiles', {
        data: {
          type: 'profiles',
          attributes: {name: fullName, profileType: want.type},
          relationships,
        },
      });
    } catch (e) {
      // Name collision with the (expired) old profile → delete it and retry.
      if (
        old &&
        (e.status === 409 ||
          /name.*taken|already exists/i.test(JSON.stringify(e.body || '')))
      ) {
        await api('DELETE', `/v1/profiles/${old.id}`);
        delete STATE.oldProfiles[fullName];
        res = await api('POST', '/v1/profiles', {
          data: {
            type: 'profiles',
            attributes: {name: fullName, profileType: want.type},
            relationships,
          },
        });
      } else throw e;
    }
    const outPath = OPTS.profileSuffix
      ? tmpFile(want.file)
      : path.join(IOS_DIR, want.file);
    fs.writeFileSync(
      outPath,
      Buffer.from(res.data.attributes.profileContent, 'base64'),
    );
    STATE.profiles[fullName] = {id: res.data.id, file: outPath};
    saveState();
    L(
      `Created profile ${fullName} (${res.data.id}) → ${path.relative(ROOT, outPath)}`,
    );
  }
}

async function cmdRenew() {
  if (!OPTS.yes)
    L('DRY RUN — no changes will be made (pass --yes to execute).\n');
  else L('EXECUTING renew (--yes).\n');

  // Step 0 — read current state of the world.
  const bundleResId = await resolveBundleResourceId();
  const deviceIds = await listEnabledDeviceIds();
  const certs = await listDistributionCerts();
  // Default to Apple Distribution (DISTRIBUTION) — the modern type Xcode expects
  // (the project pins CODE_SIGN_IDENTITY = "Apple Distribution: …"). Don't copy
  // whatever legacy iOS-Distribution cert happens to linger on the account.
  // Override with --cert-type.
  const certType = OPTS.certType || 'DISTRIBUTION';
  const existingProfiles = await listManagedProfiles();

  L('Plan:');
  L(`  bundleId resource: ${bundleResId} (${OPTS.bundleId})`);
  L(`  enabled devices:   ${deviceIds.length}`);
  L(
    `  cert type:         ${certType}${OPTS.certType ? ' (forced)' : ' (default Apple Distribution)'}`,
  );
  L(
    `  existing dist certs: ${certs.map(c => `${c.id}[${daysUntil(c.attributes.expirationDate)}d]`).join(', ') || 'none'}`,
  );
  if (OPTS.revokeCert)
    L(`  revoke first:      ${OPTS.revokeCert} (to free a cap slot)`);
  if (OPTS.p12) L(`  cert source:       BYO --p12 ${OPTS.p12}`);
  else L('  cert source:       mint a new Apple Distribution cert via ASC API');
  for (const want of PROFILES) {
    const fullName = want.name + OPTS.profileSuffix;
    const old = existingProfiles.find(p => p.attributes.name === fullName);
    L(
      `  profile ${fullName} (${want.type}${want.devices ? `, +${deviceIds.length} devices` : ''}): ${old ? `replace ${old.id}` : 'create'} → ${OPTS.profileSuffix ? '<scratch>' : `ios/${want.file}`}`,
    );
  }
  if (!OPTS.profileSuffix)
    L(
      `  re-encrypt + commit: ios/${P12_FILE}.gpg, ios/Kiroku.mobileprovision.gpg, ios/Kiroku_AdHoc.mobileprovision.gpg → PR to ${OPTS.repo}`,
    );
  else
    L(
      '  --profile-suffix set: writes scratch files only, does NOT touch ios/*.gpg or git.',
    );

  if (!OPTS.yes) {
    L(
      '\nNext (with --yes): mint cert → build+verify P12 → create profiles → re-encrypt → branch+commit+PR.',
    );
    L('Then, AFTER the PR merges: node scripts/ios-signing.mjs finalize --yes');
    return;
  }

  // Scratch/test mode: exercise only the profile-creation contract against an
  // existing valid cert. Never mints a cert, builds a P12, or touches git/.gpg.
  if (OPTS.profileSuffix) {
    const validCert = certs.filter(
      c => daysUntil(c.attributes.expirationDate) >= 0,
    )[0];
    if (!validCert)
      throw new Error(
        'Scratch mode needs an existing valid distribution cert to reference.',
      );
    loadState();
    await ensureProfiles({bundleResId, certId: validCert.id, deviceIds});
    clearState();
    L(
      `\nScratch run complete. Test profiles created (suffix "${OPTS.profileSuffix}") against cert ${validCert.id}; delete them manually. Nothing committed.`,
    );
    return;
  }

  // Guard before any local mutation.
  ensureGitReady();

  loadState();
  STATE.certType = certType;
  saveState();

  await ensureCertificate(OPTS.bundleId);
  const p12 = buildAndVerifyP12();
  // For a BYO P12 the cert lives on the account already: reference the newest
  // valid distribution cert for the profile relationship.
  const effCertId = STATE.byoP12
    ? (certs.filter(c => daysUntil(c.attributes.expirationDate) >= 0)[0] || {})
        .id
    : STATE.newCert.id;
  if (!effCertId)
    throw new Error(
      'No valid distribution cert id available for the profile relationship.',
    );
  await ensureProfiles({bundleResId, certId: effCertId, deviceIds});

  // Step 6 — re-encrypt the committed assets (overwrite the .gpg).
  fs.copyFileSync(p12.path, path.join(IOS_DIR, P12_FILE));
  STATE.p12PasswordForFinalize = p12.password;
  saveState();
  for (const f of [
    P12_FILE,
    'Kiroku.mobileprovision',
    'Kiroku_AdHoc.mobileprovision',
  ]) {
    const plain = path.join(IOS_DIR, f);
    gpgEncryptOverwrite(plain);
    fs.rmSync(plain, {force: true}); // scrub plaintext (gitignored anyway)
    L(`Re-encrypted ios/${f}.gpg`);
  }

  // Step 7 — branch, commit, push (explicit refspec — worktree branch tracks master), PR.
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14); // YYYYMMDDHHMMSS
  const branch = `automation/renew-ios-signing-${stamp}`;
  run('git', ['-C', ROOT, 'checkout', '-b', branch]);
  run('git', [
    '-C',
    ROOT,
    'add',
    `ios/${P12_FILE}.gpg`,
    'ios/Kiroku.mobileprovision.gpg',
    'ios/Kiroku_AdHoc.mobileprovision.gpg',
  ]);
  run('git', [
    '-C',
    ROOT,
    'commit',
    '-m',
    'chore(ios): renew expired signing certificate and provisioning profiles',
  ]);
  run('git', ['-C', ROOT, 'push', 'origin', `HEAD:refs/heads/${branch}`]);
  const prBody = [
    'Regenerates the expired iOS Apple Distribution certificate and the `Kiroku` / `Kiroku_AdHoc` provisioning profiles via the App Store Connect API, and re-encrypts the committed `ios/*.gpg`.',
    '',
    `New cert: \`${STATE.newCert ? STATE.newCert.id : 'BYO'}\`.`,
    '',
    '⚠️ After merge, run `node scripts/ios-signing.mjs finalize --yes` to rotate the `IOS_CERTIFICATE_PASSWORD` secret to the new P12 password and revoke the old expired cert.',
  ].join('\n');
  const prUrl = run('gh', [
    'pr',
    'create',
    '--repo',
    OPTS.repo,
    '--base',
    'master',
    '--head',
    branch,
    '--title',
    'chore(ios): renew expired signing assets',
    '--body',
    prBody,
    '--reviewer',
    'KirokuAdmin',
  ]).trim();

  L('\n──────── renew complete ────────');
  L(`PR:        ${prUrl}`);
  L(`Branch:    ${branch}`);
  if (STATE.newCert) L(`New cert:  ${STATE.newCert.id}`);
  L(
    `Old certs/profiles retained for finalize; new P12 password saved to ${path.relative(ROOT, STATE_FILE)} (gitignored, never printed).`,
  );
  L('AFTER MERGE → node scripts/ios-signing.mjs finalize --yes');
}

// ===========================================================================
// finalize (post-merge, irreversible)
// ===========================================================================
async function cmdFinalize() {
  loadState();
  if (!STATE.p12PasswordForFinalize && !STATE.byoP12)
    throw new Error(
      `No renew state found at ${path.relative(ROOT, STATE_FILE)} — nothing to finalize.`,
    );
  const password =
    STATE.p12PasswordForFinalize || (STATE.byoP12 && STATE.byoP12.password);

  L(
    OPTS.yes
      ? 'EXECUTING finalize (--yes).'
      : 'DRY RUN — pass --yes to execute.',
  );
  L('Plan:');
  L(
    `  - gh secret set IOS_CERTIFICATE_PASSWORD --repo ${OPTS.repo}  (to the new P12 password)`,
  );
  const expiredOld = [];
  if (STATE.newCert) {
    const all = await listDistributionCerts();
    for (const c of all) {
      if (
        c.id !== STATE.newCert.id &&
        daysUntil(c.attributes.expirationDate) < 0
      )
        expiredOld.push(c.id);
    }
    L(
      `  - revoke expired old dist certs: ${expiredOld.join(', ') || '(none)'}`,
    );
  }
  const oldProfiles = Object.values(STATE.oldProfiles || {});
  L(`  - delete old profiles: ${oldProfiles.join(', ') || '(none)'}`);

  if (!OPTS.yes) return;

  run(
    'gh',
    ['secret', 'set', 'IOS_CERTIFICATE_PASSWORD', '--repo', OPTS.repo],
    {input: password},
  );
  L('Rotated IOS_CERTIFICATE_PASSWORD ✓');
  for (const id of expiredOld) {
    await api('DELETE', `/v1/certificates/${id}`);
    L(`Revoked old cert ${id} ✓`);
  }
  for (const id of oldProfiles) {
    await api('DELETE', `/v1/profiles/${id}`).catch(() =>
      L(`Old profile ${id} already gone.`),
    );
    L(`Deleted old profile ${id} ✓`);
  }
  clearState();
  L('\nfinalize complete — re-run the deploy to confirm the iOS build signs.');
}

// ---- main -----------------------------------------------------------------
(async () => {
  if (OPTS.help || !cmd) return usage();
  TOKEN = mintToken(loadKey());

  if (cmd === 'check') return cmdCheck();
  if (cmd === 'renew') return cmdRenew();
  if (cmd === 'finalize') return cmdFinalize();
  usage();
  process.exitCode = 1;
})()
  .catch(e => {
    console.error('ERROR', e.message);
    process.exit(1);
  })
  .finally(cleanupTmp);
