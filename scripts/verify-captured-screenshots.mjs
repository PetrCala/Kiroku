#!/usr/bin/env node
/* eslint-disable no-console -- this is a CLI check script; stdout is its UI */
/**
 * Fail the capture job when fastlane `snapshot` did not produce every shot.
 *
 * The UI test (ios/KirokuUITests/ScreenshotTests.swift) deliberately does not
 * assert: a step that cannot reach its screen records a `[capture-miss]` and
 * moves on, so one broken selector neither hides the other five nor publishes
 * the wrong screen under the right filename. That makes the test run green even
 * when it captured nothing, which is exactly the silent failure that let a
 * broken pipeline sit unnoticed for months (the workflow's artifact upload also
 * only warns on an empty match).
 *
 * This is the gate instead: it looks at the PNGs that actually landed on disk
 * and compares them against the shot manifest the framing pipeline will consume
 * (scripts/store-screenshots.config.mjs), so capture and framing cannot drift.
 *
 * Usage:
 *   node scripts/verify-captured-screenshots.mjs
 *   node scripts/verify-captured-screenshots.mjs --from fastlane/screenshots/ios
 *   node scripts/verify-captured-screenshots.mjs --min-bytes 20000
 */

import {existsSync, readdirSync, statSync} from 'fs';
import {dirname, isAbsolute, join} from 'path';
import {fileURLToPath} from 'url';
// eslint-disable-next-line import/extensions -- Node ESM requires the explicit extension
import config from './store-screenshots.config.mjs';

const {shots, captureLocales} = config;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(scriptDir, '..');

const args = process.argv.slice(2);
const flag = name => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};

const fromArg = flag('from');
function resolveFromDir(value) {
  if (typeof value !== 'string') {
    return join(ROOT, 'fastlane', 'screenshots', 'ios');
  }
  return isAbsolute(value) ? value : join(ROOT, value);
}
const fromDir = resolveFromDir(fromArg);

// A capture that failed mid-render still writes a file, so size is part of the
// check. A 1320x2868 screenshot of a real screen is hundreds of KB; anything
// this small is a blank or partial frame.
const minBytes = Number(flag('min-bytes') ?? 20000);

// Every shot the UI test emits. `07_Settings` is captured but intentionally not
// mapped into the store listing, so it is not in the manifest; require only
// what the framing pipeline actually consumes.
const expected = shots.filter(s => s.snapshot).map(s => s.snapshot);

const captureLocaleDirs = new Set(Object.values(captureLocales));

if (!existsSync(fromDir)) {
  console.error(`FAIL no capture directory at ${fromDir}`);
  console.error('fastlane `snapshot` produced nothing at all.');
  process.exit(1);
}

const localeDirs = readdirSync(fromDir, {withFileTypes: true})
  .filter(d => d.isDirectory() && captureLocaleDirs.has(d.name))
  .map(d => d.name)
  .sort();

if (localeDirs.length === 0) {
  console.error(`FAIL no locale folders under ${fromDir}`);
  console.error(
    `Expected one of ${[...captureLocaleDirs].join(', ')}; found ${JSON.stringify(
      readdirSync(fromDir),
    )}.`,
  );
  process.exit(1);
}

const problems = [];
let checked = 0;

for (const locale of localeDirs) {
  const localeDir = join(fromDir, locale);
  const deviceDirs = readdirSync(localeDir, {withFileTypes: true})
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  if (deviceDirs.length === 0) {
    problems.push(`${locale}: no device folders (nothing was captured)`);
    continue;
  }

  for (const device of deviceDirs) {
    for (const name of expected) {
      const file = join(localeDir, device, `${name}.png`);
      checked += 1;
      if (!existsSync(file)) {
        problems.push(`${locale}/${device}: missing ${name}.png`);
        continue;
      }
      const {size} = statSync(file);
      if (size < minBytes) {
        problems.push(
          `${locale}/${device}: ${name}.png is only ${size} bytes (< ${minBytes})`,
        );
      }
    }
  }
  console.log(`${locale}: ${deviceDirs.join(', ')}`);
}

console.log(
  `\nChecked ${checked} expected file(s) across ${localeDirs.length} locale(s).`,
);

if (problems.length > 0) {
  console.error(`\nFAIL ${problems.length} problem(s):`);
  for (const p of problems) {
    console.error(`  - ${p}`);
  }
  console.error(
    '\nGrep the fastlane log for "[capture-miss]" to see which navigation step failed.',
  );
  process.exit(1);
}

console.log('OK every expected screenshot was captured.');
