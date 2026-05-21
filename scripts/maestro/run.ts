#!/usr/bin/env npx ts-node
/**
 * Maestro orchestrator: handles disposable test-user lifecycle around
 * `maestro test` so the YAML flows stay declarative.
 *
 * For each flow:
 *   1. Generates a unique email (maestro+<runId>-<flow>@kiroku.test).
 *   2. (login/reset flows) Pre-seeds the user in dev Firebase, marks
 *      email verified, completes onboarding shape in the DB.
 *   3. Runs `maestro test <flow>` with EMAIL/PASSWORD injected via --env.
 *   4. Tears down the Firebase user, regardless of flow outcome.
 *
 * Env:
 *   FIREBASE_DEV_ADMIN_SA   service-account JSON (single line); required
 *   MAESTRO_RUN_ID          optional run identifier (defaults to PID)
 *   FLOWS                   optional comma-separated flow basenames to run
 *                           (default: all flows under .maestro/flows/)
 */
import {spawnSync} from 'child_process';
import {readdirSync} from 'fs';
import path from 'path';
import admin from 'firebase-admin';

const ROOT = path.resolve(__dirname, '..', '..');
const FLOWS_DIR = path.join(ROOT, '.maestro', 'flows');
const RUN_ID = process.env.MAESTRO_RUN_ID ?? String(process.pid);
const PASSWORD = 'MaestroTest123!';

type FlowName =
  | 'signup-email-password'
  | 'login-existing-user'
  | 'forgot-password-flow';

const PRE_SEEDED: ReadonlySet<FlowName> = new Set([
  'login-existing-user',
  'forgot-password-flow',
]);

function emailFor(flow: FlowName): string {
  return `maestro+${RUN_ID}-${flow}@kiroku.test`;
}

function initFirebase(): void {
  const raw = process.env.FIREBASE_DEV_ADMIN_SA;
  if (!raw) {
    throw new Error(
      'FIREBASE_DEV_ADMIN_SA is required (dev Firebase service-account JSON)',
    );
  }
  const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function seedUser(email: string): Promise<void> {
  const user = await admin.auth().createUser({
    email,
    password: PASSWORD,
    emailVerified: true,
  });
  // Mark onboarding complete so the login flow lands on Home, not the
  // onboarding modal. Adjust if/when onboarding shape changes.
  await admin.database().ref(`users/${user.uid}/private/onboarding`).set({
    isComplete: true,
    acceptedTermsVersion: 1,
  });
}

async function deleteUser(email: string): Promise<void> {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.database().ref(`users/${user.uid}`).remove();
    await admin.auth().deleteUser(user.uid);
  } catch (err) {
    if ((err as {code?: string}).code !== 'auth/user-not-found') {
      throw err;
    }
  }
}

function runFlow(flow: FlowName, email: string): number {
  const result = spawnSync(
    'maestro',
    [
      'test',
      path.join(FLOWS_DIR, `${flow}.yaml`),
      '--env',
      `EMAIL=${email}`,
      '--env',
      `PASSWORD=${PASSWORD}`,
    ],
    {stdio: 'inherit', cwd: ROOT},
  );
  return result.status ?? 1;
}

function flowsToRun(): FlowName[] {
  const explicit = process.env.FLOWS?.split(',').map(s => s.trim()) ?? [];
  if (explicit.length > 0) {
    return explicit as FlowName[];
  }
  return readdirSync(FLOWS_DIR)
    .filter(f => f.endsWith('.yaml'))
    .map(f => f.replace(/\.yaml$/, '') as FlowName);
}

async function main(): Promise<void> {
  initFirebase();
  let failed = 0;
  // Flows run sequentially: each owns a unique disposable user, but we
  // share one emulator and one Firebase project, so parallelism would
  // race on screen state and quota.
  for (const flow of flowsToRun()) {
    const email = emailFor(flow);
    process.stderr.write(`\n=== ${flow} (${email}) ===\n`);
    try {
      if (PRE_SEEDED.has(flow)) {
        // eslint-disable-next-line no-await-in-loop
        await seedUser(email);
      }
      const code = runFlow(flow, email);
      if (code !== 0) {
        failed += 1;
      }
    } finally {
      // eslint-disable-next-line no-await-in-loop
      await deleteUser(email);
    }
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
