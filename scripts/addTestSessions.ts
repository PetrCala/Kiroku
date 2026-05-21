/**
 * One-off admin script: seed drinking sessions for a user in the dev Firebase.
 *
 * Usage:
 *   npx ts-node --project scripts/tsconfig.json scripts/addTestSessions.ts
 *   npx ts-node --project scripts/tsconfig.json scripts/addTestSessions.ts --email=someone@example.com --count=50
 *
 * Reads the dev service account from /Users/petr/code/Kiroku/kiroku-admin-sdk-dev.json
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import parseCommandLineArguments from './utils/parseCommandLineArguments';
import * as Logger from './utils/Logger';

// ─── Config ──────────────────────────────────────────────────────────────────

const SERVICE_ACCOUNT_PATH = path.resolve(
  __dirname,
  '../../../../kiroku-admin-sdk-dev.json',
);
const DATABASE_URL =
  'https://dev-alcohol-tracker-db-default-rtdb.europe-west1.firebasedatabase.app';

const DRINK_KEYS = [
  'small_beer',
  'beer',
  'cocktail',
  'other',
  'strong_shot',
  'weak_shot',
  'wine',
] as const;

type DrinkKey = (typeof DRINK_KEYS)[number];
type Drinks = Partial<Record<DrinkKey, number>>;
type DrinksList = Record<string, Drinks>;

type DrinkingSession = {
  start_time: number;
  end_time: number;
  timezone: string;
  drinks?: DrinksList;
  blackout?: boolean;
  note?: string;
  type: 'edit';
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randChoice<T>(arr: readonly T[]): T {
  return arr[rand(0, arr.length - 1)];
}

/** Generate a Firebase-style push ID (time-ordered, client-side). */
function generatePushId(): string {
  const PUSH_CHARS =
    '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let now = Date.now();
  let id = '';
  for (let i = 7; i >= 0; i--) {
    id = PUSH_CHARS.charAt(now % 64) + id;
    now = Math.floor(now / 64);
  }
  for (let i = 0; i < 12; i++) {
    id += PUSH_CHARS.charAt(rand(0, 63));
  }
  return id;
}

/** Build a DrinksList: 1–4 drink entries spread across the session window. */
function buildDrinksList(
  sessionStart: number,
  sessionEnd: number,
): DrinksList | undefined {
  if (Math.random() < 0.08) {
    return undefined; // ~8% of sessions have no drinks logged
  }
  const count = rand(1, 4);
  const list: DrinksList = {};
  const window = sessionEnd - sessionStart;
  for (let i = 0; i < count; i++) {
    const ts = sessionStart + rand(0, window);
    const drinks: Drinks = {};
    const numTypes = rand(1, 3);
    const keys = [...DRINK_KEYS].sort(() => 0.5 - Math.random()).slice(0, numTypes);
    for (const key of keys) {
      drinks[key as DrinkKey] = rand(1, 4);
    }
    list[String(ts)] = drinks;
  }
  return list;
}

const NOTES = [
  "Great evening with friends",
  "Work happy hour",
  "Birthday party",
  "Just a quiet night in",
  "Game night",
  "Date night",
  "Concert",
  "Housewarming",
  "Holiday dinner",
  "Backyard BBQ",
  "Sports bar",
  "Wine tasting",
  "Karaoke night",
  "Trivia night",
  "",
  "",
  "",
  "",
  "",
  "",
];

/** Build a single realistic session somewhere in the past `dayRange` days. */
function buildSession(dayRange: number): DrinkingSession {
  const now = Date.now();
  const daysAgo = rand(0, dayRange);
  // Bias toward evenings (6 PM – 2 AM)
  const hourOfDay = rand(18, 25) % 24;
  const startOffset =
    daysAgo * 86_400_000 + hourOfDay * 3_600_000 + rand(0, 3_600_000);
  const start_time = now - startOffset;
  const durationMs = rand(30, 300) * 60_000; // 30 min – 5 hours
  const end_time = start_time + durationMs;

  const drinks = buildDrinksList(start_time, end_time);
  const note = randChoice(NOTES);
  const blackout = Math.random() < 0.12;

  const session: DrinkingSession = {
    start_time,
    end_time,
    timezone: 'America/New_York',
    type: 'edit',
    ...(drinks !== undefined ? {drinks} : {}),
    ...(blackout ? {blackout: true} : {}),
    ...(note ? {note} : {}),
  };

  return session;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseCommandLineArguments();

  if (args.help) {
    console.log(
      'Usage: npx ts-node --project scripts/tsconfig.json scripts/addTestSessions.ts [--email=EMAIL] [--count=N] [--days=D]',
    );
    console.log('  --email  Target user email (default: juke797@gmail.com)');
    console.log('  --count  Number of sessions to add (default: 150)');
    console.log(
      '  --days   How many days in the past to spread sessions (default: 730)',
    );
    process.exit(0);
  }

  const targetEmail = args.email ?? 'juke797@gmail.com';
  const count = parseInt(args.count ?? '150', 10);
  const dayRange = parseInt(args.days ?? '730', 10);

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    Logger.error(`Service account not found at: ${SERVICE_ACCOUNT_PATH}`);
    process.exit(1);
  }

  Logger.info(`Initializing Firebase Admin (dev project)…`);
  const serviceAccount = JSON.parse(
    fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'),
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: DATABASE_URL,
  });

  const auth = admin.auth();
  const db = admin.database();

  // Look up user UID from email
  Logger.info(`Looking up user: ${targetEmail}`);
  let uid: string;
  try {
    const userRecord = await auth.getUserByEmail(targetEmail);
    uid = userRecord.uid;
    Logger.success(`Found user: ${uid}`);
  } catch (e) {
    Logger.error(`User not found for email "${targetEmail}": ${String(e)}`);
    process.exit(1);
  }

  // Build all sessions and a batched multi-path update
  Logger.info(`Generating ${count} sessions spread over ${dayRange} days…`);
  const updates: Record<string, DrinkingSession> = {};
  for (let i = 0; i < count; i++) {
    const sessionId = generatePushId();
    updates[`user_drinking_sessions/${uid}/${sessionId}`] = buildSession(dayRange);
  }

  Logger.info(`Writing ${count} sessions to Firebase…`);
  await db.ref().update(updates);

  Logger.success(`Done! Added ${count} sessions for ${targetEmail} (uid: ${uid}).`);
  process.exit(0);
}

main().catch(err => {
  Logger.error('Unhandled error:', err);
  process.exit(1);
});
