#!/usr/bin/env node
/**
 * Keeps the Google Sign-In URL schemes in ios/kiroku/Info.plist in lockstep
 * with the three GoogleService-Info plists.
 *
 * Google Sign-In hands its result back to the app through a custom URL scheme
 * equal to the Firebase app's REVERSED_CLIENT_ID. That value lives in two
 * places: the generated GoogleService-Info plist (source of truth) and the
 * CFBundleURLSchemes array in Info.plist (hand-maintained). When they drift,
 * nothing errors: the sign-in sheet opens, the user picks an account, and the
 * callback never arrives. This script removes the hand-maintenance.
 *
 * The schemes are written in a fixed order (prod, dev, adhoc) so the diff is
 * stable no matter which plist was regenerated.
 *
 * Usage:
 *   node scripts/sync-ios-url-schemes.mjs           # write
 *   node scripts/sync-ios-url-schemes.mjs --check   # exit 1 if Info.plist is stale
 *   node scripts/sync-ios-url-schemes.mjs --root D  # operate on a copy of the repo
 *
 * Regenerate a plist with:
 *   firebase apps:sdkconfig IOS <appId> --project <projectId> \
 *     -o ios/config/GoogleService-Info.<variant>.plist
 * then run this script.
 */

import {readFileSync, writeFileSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));

// The write order of CFBundleURLSchemes. iOS does not care about the order,
// but a fixed one keeps the file diff-stable.
const SOURCES = [
  {variant: 'prod', path: 'ios/config/GoogleService-Info.prod.plist'},
  {variant: 'dev', path: 'ios/config/GoogleService-Info.dev.plist'},
  {variant: 'adhoc', path: 'ios/config/GoogleService-Info.adhoc.plist'},
];

const INFO_PLIST = 'ios/kiroku/Info.plist';

// Every Google OAuth iOS client reverses to this prefix. Anything else in the
// array belongs to a different URL type and must not be touched.
const GOOGLE_SCHEME_PREFIX = 'com.googleusercontent.apps.';

function parseArgs(argv) {
  const checkMode = argv.includes('--check');
  const rootFlag = argv.indexOf('--root');
  if (rootFlag !== -1 && !argv[rootFlag + 1]) {
    throw new Error('--root needs a directory argument');
  }
  const root = rootFlag === -1 ? join(scriptDir, '..') : argv[rootFlag + 1];
  return {checkMode, root};
}

function readPlistString(content, key) {
  const re = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`);
  const match = content.match(re);
  return match ? match[1].trim() : undefined;
}

/**
 * A GoogleService-Info plist carries the OAuth client id twice: once forward
 * (CLIENT_ID) and once reversed (REVERSED_CLIENT_ID). Hand-editing one and not
 * the other is the exact mistake this whole script exists to catch, so verify
 * they agree before trusting either.
 */
function readReversedClientId(root, {variant, path}) {
  let content;
  try {
    content = readFileSync(join(root, path), 'utf8');
  } catch {
    throw new Error(`${path}: not found. Has the ${variant} config moved?`);
  }

  const reversed = readPlistString(content, 'REVERSED_CLIENT_ID');
  if (!reversed) {
    throw new Error(
      `${path}: no REVERSED_CLIENT_ID. A Firebase iOS app only gets one once ` +
        `an OAuth client exists for it. Re-download the config after enabling ` +
        `Google Sign-In on the project.`,
    );
  }
  if (!reversed.startsWith(GOOGLE_SCHEME_PREFIX)) {
    throw new Error(
      `${path}: REVERSED_CLIENT_ID "${reversed}" does not start with ` +
        `"${GOOGLE_SCHEME_PREFIX}".`,
    );
  }

  const forward = readPlistString(content, 'CLIENT_ID');
  if (forward) {
    const expected = `${GOOGLE_SCHEME_PREFIX}${forward.replace(
      /\.apps\.googleusercontent\.com$/,
      '',
    )}`;
    if (expected !== reversed) {
      throw new Error(
        `${path}: CLIENT_ID and REVERSED_CLIENT_ID disagree.\n` +
          `  CLIENT_ID          ${forward}\n` +
          `  REVERSED_CLIENT_ID ${reversed}\n` +
          `  expected           ${expected}\n` +
          `This plist has been hand-edited. Re-download it from Firebase.`,
      );
    }
  }

  return {
    variant,
    path,
    scheme: reversed,
    bundleId: readPlistString(content, 'BUNDLE_ID'),
    projectId: readPlistString(content, 'PROJECT_ID'),
  };
}

/**
 * Locates the CFBundleURLSchemes array that holds the Google schemes. Info.plist
 * may grow other URL types (deep links, OAuth callbacks for other providers);
 * matching on content rather than position keeps this from rewriting the wrong
 * one.
 */
function findGoogleSchemeArray(content) {
  const re =
    /<key>CFBundleURLSchemes<\/key>\s*\n(\s*)<array>\n([\s\S]*?)\n\s*<\/array>/g;
  const candidates = [];
  let match = re.exec(content);
  while (match !== null) {
    const [full, arrayIndent, body] = match;
    const entries = [...body.matchAll(/<string>([^<]*)<\/string>/g)].map(
      m => m[1],
    );
    if (entries.some(entry => entry.startsWith(GOOGLE_SCHEME_PREFIX))) {
      candidates.push({full, arrayIndent, body, entries, index: match.index});
    }
    match = re.exec(content);
  }

  if (candidates.length === 0) {
    throw new Error(
      `${INFO_PLIST}: no CFBundleURLSchemes array containing a ` +
        `"${GOOGLE_SCHEME_PREFIX}…" entry. Has the file shape changed?`,
    );
  }
  if (candidates.length > 1) {
    throw new Error(
      `${INFO_PLIST}: ${candidates.length} CFBundleURLSchemes arrays contain ` +
        `Google schemes. Expected exactly one; refusing to guess.`,
    );
  }
  return candidates[0];
}

function renderArray(target, schemes) {
  // Reuse the indentation of the first existing entry so the rewrite matches
  // the file's tabs rather than imposing its own.
  const entryIndent =
    target.body.match(/^([ \t]*)<string>/)?.[1] ?? `${target.arrayIndent}\t`;
  const entries = schemes
    .map(scheme => `${entryIndent}<string>${scheme}</string>`)
    .join('\n');
  return `<key>CFBundleURLSchemes</key>\n${target.arrayIndent}<array>\n${entries}\n${target.arrayIndent}</array>`;
}

function main() {
  const {checkMode, root} = parseArgs(process.argv.slice(2));

  const sources = SOURCES.map(source => readReversedClientId(root, source));

  const seen = new Map();
  for (const source of sources) {
    const previous = seen.get(source.scheme);
    if (previous) {
      throw new Error(
        `${source.path} and ${previous} share REVERSED_CLIENT_ID ` +
          `"${source.scheme}". Each Firebase iOS app has its own OAuth client; ` +
          `one of these configs was copied rather than downloaded.`,
      );
    }
    seen.set(source.scheme, source.path);
  }

  console.log(`Source of truth (${sources.length} configs):`);
  for (const source of sources) {
    console.log(`  ${source.variant.padEnd(5)} ${source.scheme}`);
    console.log(
      `        ${source.bundleId ?? '(no BUNDLE_ID)'} @ ${
        source.projectId ?? '(no PROJECT_ID)'
      }`,
    );
  }
  console.log();

  const infoPath = join(root, INFO_PLIST);
  const before = readFileSync(infoPath, 'utf8');
  const target = findGoogleSchemeArray(before);

  // Keep any non-Google entry that shares the array (nothing does today, but
  // dropping one silently would be its own quiet breakage).
  const foreign = target.entries.filter(
    entry => !entry.startsWith(GOOGLE_SCHEME_PREFIX),
  );
  const schemes = [...sources.map(source => source.scheme), ...foreign];

  const after =
    before.slice(0, target.index) +
    renderArray(target, schemes) +
    before.slice(target.index + target.full.length);

  if (before === after) {
    console.log(`✓ ${INFO_PLIST} is in sync.`);
    return;
  }

  if (checkMode) {
    console.error(`✗ ${INFO_PLIST} is out of sync.`);
    console.error(`  have: ${target.entries.join(', ') || '(empty)'}`);
    console.error(`  want: ${schemes.join(', ')}`);
    console.error();
    console.error(
      'Run `npm run sync-ios-url-schemes` to fix. Google Sign-In fails ' +
        'silently while these disagree.',
    );
    process.exit(1);
  }

  writeFileSync(infoPath, after);
  console.log(`↻ ${INFO_PLIST} updated.`);
  console.log(`  was: ${target.entries.join(', ') || '(empty)'}`);
  console.log(`  now: ${schemes.join(', ')}`);
}

try {
  main();
} catch (error) {
  console.error(`sync-ios-url-schemes: ${error.message}`);
  process.exit(1);
}
