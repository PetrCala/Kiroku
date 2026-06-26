#!/usr/bin/env node
/* eslint-disable no-bitwise */
/**
 * Kiroku Apple Watch — Phase 0 spike (zero-dependency).
 *
 * Proves the watchOS data path WITHOUT any Xcode/Swift work: it reproduces the
 * exact request the watch will send, posting a live drinking session to
 * kiroku-api the same way the app does, then (by default) deleting it again.
 *
 * This is the executable spec of the contract the native watch client must
 * replicate in Phase 2. It mirrors:
 *   - `generatePushID()`            (src/libs/generatePushID.ts)      → session id
 *   - `getEmptySession()`           (src/libs/DrinkingSessionUtils.ts)→ session body
 *   - `UPDATE_SESSION`/`DELETE_SESSION` routes (src/libs/API/kirokuRoutes.ts)
 *   - the `Authorization: Bearer <idToken>` + JSON body from HttpUtils.ts
 *
 * Requires Node 18+ (global fetch). No npm dependencies.
 *
 * Usage:
 *   node scripts/watch-spike/post-session.mjs --token <FIREBASE_ID_TOKEN>
 *   node scripts/watch-spike/post-session.mjs --env prod --units 3 --keep
 *
 * The token is a short-lived (~1h) Firebase ID token for a DEV account. See the
 * README in this folder for how to grab one. Pass it via --token or the
 * KIROKU_ID_TOKEN env var. The token is never logged.
 */

import {randomBytes} from 'node:crypto';
import process from 'node:process';

const API_ROOTS = {
  dev: 'https://api-dev.kiroku.cz',
  prod: 'https://api.kiroku.cz',
};

const DRINK_KEYS = [
  'small_beer',
  'beer',
  'cocktail',
  'wine',
  'strong_shot',
  'weak_shot',
  'other',
];

// ---------------------------------------------------------------------------
// generatePushID — faithful port of src/libs/generatePushID.ts
// ---------------------------------------------------------------------------

const PUSH_CHARS =
  '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
let lastPushTime = 0;
const lastRandChars = new Array(12).fill(0);

function rerollRandChars() {
  const bytes = randomBytes(9);
  for (let i = 0; i < 12; i++) {
    const bitPos = i * 6;
    const bytePos = bitPos >> 3;
    const bitOffset = bitPos & 7;
    const hi = bytes[bytePos];
    const lo = bytePos + 1 < bytes.length ? bytes[bytePos + 1] : 0;
    const bits = (hi << 8) | lo;
    lastRandChars[i] = (bits >> (10 - bitOffset)) & 0x3f;
  }
}

function generatePushID() {
  let now = Date.now();
  const duplicateTime = now === lastPushTime;
  lastPushTime = now;

  const timeStampChars = new Array(8);
  for (let i = 7; i >= 0; i--) {
    timeStampChars[i] = PUSH_CHARS.charAt(now % 64);
    now = Math.floor(now / 64);
  }
  if (now !== 0) {
    throw new Error('generatePushID: timestamp did not fully convert');
  }

  let id = timeStampChars.join('');

  if (!duplicateTime) {
    rerollRandChars();
  } else {
    let i = 11;
    for (; i >= 0 && lastRandChars[i] === 63; i--) {
      lastRandChars[i] = 0;
    }
    if (i >= 0) {
      lastRandChars[i]++;
    } else {
      rerollRandChars();
    }
  }

  for (let i = 0; i < 12; i++) {
    id += PUSH_CHARS.charAt(lastRandChars[i]);
  }

  if (id.length !== 20) {
    throw new Error('generatePushID: generated id length is not 20');
  }
  return id;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {env: 'dev', units: 2, keep: false, drink: 'beer'};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--token') {
      args.token = argv[++i];
    } else if (a === '--env') {
      args.env = argv[++i];
    } else if (a === '--units') {
      args.units = Number(argv[++i]);
    } else if (a === '--drink') {
      args.drink = argv[++i];
    } else if (a === '--keep') {
      args.keep = true;
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    }
  }
  return args;
}

function usage() {
  console.log(`Kiroku Apple Watch — Phase 0 spike

Posts a live drinking session to kiroku-api exactly as the watch will, then
deletes it (unless --keep).

Options:
  --token <idToken>   Firebase ID token (DEV account). Or set KIROKU_ID_TOKEN.
  --env dev|prod      API environment (default: dev).
  --units <n>         Number of units to log (default: 2).
  --drink <key>       Drink key (default: beer). One of:
                      ${DRINK_KEYS.join(', ')}.
  --keep              Do NOT delete the session afterwards (leave it for the
                      phone app to display).
  -h, --help          Show this help.`);
}

/** Build a session body equivalent to getEmptySession(...) + drinks. */
function buildSession(sessionId, units, drinkKey) {
  const now = Date.now();
  const drinks = {};
  if (units > 0) {
    // The app groups drinks by timestamp; one bucket at "now" is enough here.
    drinks[String(now)] = {[drinkKey]: units};
  }
  return {
    id: sessionId,
    start_time: now,
    end_time: now,
    blackout: false,
    note: '',
    timezone: 'Europe/Prague',
    type: 'live',
    ongoing: true,
    ...(units > 0 ? {drinks} : {}),
  };
}

async function postJson(root, path, token, body) {
  const res = await fetch(`${root}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  let parsed;
  const text = await res.text();
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return {status: res.status, body: parsed};
}

function explainAuthFailure(status) {
  if (status === 401) {
    return 'HTTP 401 — the token is revoked/invalid. Grab a fresh one.';
  }
  if (status === 407) {
    return 'jsonCode/HTTP 407 — the ID token is expired (they last ~1h). Grab a fresh one.';
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const token = args.token || process.env.KIROKU_ID_TOKEN;
  if (!token) {
    console.error(
      'Missing token. Pass --token <idToken> or set KIROKU_ID_TOKEN.\n',
    );
    usage();
    process.exitCode = 1;
    return;
  }
  const root = API_ROOTS[args.env];
  if (!root) {
    console.error(`Unknown --env "${args.env}". Use "dev" or "prod".`);
    process.exitCode = 1;
    return;
  }
  if (!DRINK_KEYS.includes(args.drink)) {
    console.error(
      `Unknown --drink "${args.drink}". One of: ${DRINK_KEYS.join(', ')}.`,
    );
    process.exitCode = 1;
    return;
  }
  if (args.env === 'prod') {
    console.warn('⚠️  Targeting PRODUCTION. This writes a real session.\n');
  }

  const sessionId = generatePushID();
  const session = buildSession(sessionId, args.units, args.drink);

  console.log(`→ env=${args.env}  root=${root}`);
  console.log(`→ sessionId=${sessionId}  units=${args.units} ${args.drink}`);
  console.log('→ POST /v1/sessions/update  (sessionIsLive: true)');

  const update = await postJson(root, '/v1/sessions/update', token, {
    sessionId,
    session,
    sessionIsLive: true,
  });
  console.log(`  ← ${update.status}`, JSON.stringify(update.body));

  const authMsg = explainAuthFailure(update.status);
  if (authMsg) {
    console.error(`\n✗ ${authMsg}`);
    process.exitCode = 1;
    return;
  }
  if (update.status < 200 || update.status >= 300) {
    console.error('\n✗ update failed — see response above.');
    process.exitCode = 1;
    return;
  }

  console.log('\n✓ Session created.');
  if (args.keep) {
    console.log(
      `Kept session ${sessionId}. Open the phone app (same account) to confirm ` +
        'it appears as a live session, then discard it from the app.',
    );
    return;
  }

  console.log('→ POST /v1/sessions/delete  (cleanup)');
  const del = await postJson(root, '/v1/sessions/delete', token, {
    sessionId,
    sessionIsLive: true,
  });
  console.log(`  ← ${del.status}`, JSON.stringify(del.body));
  if (del.status < 200 || del.status >= 300) {
    console.error(
      `\n⚠️  delete failed — session ${sessionId} may still exist. Remove it from the app.`,
    );
    process.exitCode = 1;
    return;
  }
  console.log('\n✓ Round-trip OK: create + delete both succeeded.');
}

main().catch(err => {
  console.error('Unexpected error:', err?.message ?? err);
  process.exitCode = 1;
});
