#!/usr/bin/env ts-node

/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import CONST from '@src/CONST';
import DBPATHS from '@src/DBPATHS';
import type UserData from '@src/types/onyx/UserData';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import parseCommandLineArguments from '../utils/parseCommandLineArguments';
import * as Logger from '../utils/Logger';

const HELP_TEXT = `
Backfill onboarding completion + terms version for existing users.

Usage:
  npx ts-node scripts/migrations/backfill-onboarding.ts [options]

Options:
  --dry-run                Print the changes that would be applied, do not write.
  --credentials=<path>     Path to a Firebase service-account JSON file.
                           Falls back to GOOGLE_APPLICATION_CREDENTIALS.
  --database-url=<url>     Firebase Realtime Database URL.
                           Falls back to FIREBASE_DATABASE_URL.
  --batch-size=<n>         Multi-path update batch size (default: 500).
  --help                   Show this help.

The script is idempotent: users whose onboarding.completed_at is already set
are skipped. Re-running is a no-op.
`.trimStart();

const BATCH_SIZE_DEFAULT = 500;

type UsersSnapshot = Record<UserID, UserData> | null;

type Stats = {
  scanned: number;
  updated: number;
  skippedAlreadyComplete: number;
  skippedNoTerms: number;
  skippedUsernameGatePending: number;
};

function fail(message: string): never {
  Logger.error(message);
  process.exit(1);
}

function loadCredentials(credentialsPath: string): admin.ServiceAccount {
  const resolved = path.resolve(credentialsPath);
  if (!fs.existsSync(resolved)) {
    fail(`Credentials file not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw) as admin.ServiceAccount;
}

async function applyBatch(
  ref: admin.database.Reference,
  updates: Record<string, unknown>,
  dryRun: boolean,
): Promise<void> {
  if (dryRun || Object.keys(updates).length === 0) {
    return;
  }
  await ref.update(updates);
}

async function run(): Promise<void> {
  const args = parseCommandLineArguments();

  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  const dryRun = args['dry-run'] !== undefined;
  const credentialsPath =
    args.credentials ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const databaseURL = args['database-url'] ?? process.env.FIREBASE_DATABASE_URL;
  const batchSize = args['batch-size']
    ? Number.parseInt(args['batch-size'], 10)
    : BATCH_SIZE_DEFAULT;

  if (!credentialsPath) {
    fail(
      'Missing service-account credentials. Pass --credentials=<path> or set GOOGLE_APPLICATION_CREDENTIALS.',
    );
  }
  if (!databaseURL) {
    fail(
      'Missing database URL. Pass --database-url=<url> or set FIREBASE_DATABASE_URL.',
    );
  }
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    fail(`Invalid --batch-size: ${args['batch-size']}`);
  }

  admin.initializeApp({
    credential: admin.credential.cert(loadCredentials(credentialsPath)),
    databaseURL,
  });

  Logger.info(
    `Backfilling onboarding against ${databaseURL} ${dryRun ? '(DRY RUN)' : '(LIVE)'}`,
  );

  const rootRef = admin.database().ref();
  const usersRef = rootRef.child(DBPATHS.USERS);
  const snapshot = await usersRef.once('value');
  const users = snapshot.val() as UsersSnapshot;

  const stats: Stats = {
    scanned: 0,
    updated: 0,
    skippedAlreadyComplete: 0,
    skippedNoTerms: 0,
    skippedUsernameGatePending: 0,
  };

  if (!users) {
    Logger.warn('No /users data found — nothing to backfill.');
    await admin.app().delete();
    return;
  }

  let pendingUpdates: Record<string, unknown> = {};
  let pendingCount = 0;

  for (const [uid, data] of Object.entries(users)) {
    stats.scanned += 1;

    if (data?.onboarding?.completed_at) {
      stats.skippedAlreadyComplete += 1;
    } else if (data?.profile?.username_chosen === false) {
      stats.skippedUsernameGatePending += 1;
    } else if (!data?.agreed_to_terms_at) {
      stats.skippedNoTerms += 1;
    } else {
      const completedAt = data.agreed_to_terms_at ?? Date.now();
      const completedAtPath =
        DBPATHS.USERS_USER_ID_ONBOARDING_COMPLETED_AT.getRoute(uid);
      const termsVersionPath =
        DBPATHS.USERS_USER_ID_AGREED_TO_TERMS_VERSION.getRoute(uid);

      pendingUpdates[completedAtPath] = completedAt;
      pendingUpdates[termsVersionPath] = CONST.CURRENT_TERMS_VERSION;
      pendingCount += 1;
      stats.updated += 1;

      Logger.note(
        `${dryRun ? '[DRY RUN] ' : ''}${uid}: completed_at=${completedAt}, terms_version=${CONST.CURRENT_TERMS_VERSION}`,
      );

      if (pendingCount >= batchSize) {
        await applyBatch(rootRef, pendingUpdates, dryRun);
        pendingUpdates = {};
        pendingCount = 0;
      }
    }
  }

  await applyBatch(rootRef, pendingUpdates, dryRun);

  Logger.success(
    `Done. scanned=${stats.scanned} updated=${stats.updated} ` +
      `skipped.alreadyComplete=${stats.skippedAlreadyComplete} ` +
      `skipped.noTerms=${stats.skippedNoTerms} ` +
      `skipped.usernameGatePending=${stats.skippedUsernameGatePending}` +
      `${dryRun ? ' (DRY RUN — no writes performed)' : ''}`,
  );

  await admin.app().delete();
}

run().catch(err => {
  Logger.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
