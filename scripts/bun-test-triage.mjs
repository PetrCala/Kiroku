#!/usr/bin/env node
/**
 * Kiroku `bun test` portability triage (zero-dependency).
 *
 * Classifies every file in the Jest suite by whether it can run under
 * `bun test` today, so the "should we move off Jest yet?" question can be
 * re-answered with one command instead of a fresh investigation.
 *
 * Each file lands in exactly one bucket:
 *   clean    passes under bun with no failures
 *   failing  loads under bun, but at least one test fails
 *   blocked  throws before any test runs (almost always the Flow-typed
 *            react-native import graph, which bun's transpiler cannot parse)
 *
 * Bun is always invoked with --isolate. Without it, bun shares one module
 * registry across every file and mocks leak between them; --isolate gives each
 * file a fresh global and registry, which is the only mode where the results
 * mean anything.
 *
 * Requires Node 18+ and bun on PATH. No npm dependencies.
 *
 * Usage:
 *   node scripts/bun-test-triage.mjs              # full triage + summary
 *   node scripts/bun-test-triage.mjs --json out.json
 *   node scripts/bun-test-triage.mjs --list clean # print one bucket, one path per line
 *   node scripts/bun-test-triage.mjs --run        # just run the clean bucket (fast inner loop)
 *
 * See contributingGuides/BUN_TEST.md for the findings this produces.
 */

import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const BUCKETS = ['clean', 'failing', 'blocked'];

function parseArgs(argv) {
  const args = {json: null, list: null, run: false};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = argv[++i];
    } else if (arg === '--list') {
      args.list = argv[++i];
    } else if (arg === '--run') {
      args.run = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (args.list && !BUCKETS.includes(args.list)) {
    throw new Error(`--list expects one of: ${BUCKETS.join(', ')}`);
  }
  return args;
}

/**
 * The authoritative file list is whatever Jest itself matches, so the triage
 * can never drift from the real suite as testMatch changes.
 */
function discoverTestFiles() {
  const out = execFileSync('npx', ['jest', '--listTests', '--silent'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return out
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('/'))
    .map(abs => path.relative(ROOT, abs))
    .sort();
}

function runBun(files, extraArgs = [], env = {}) {
  return spawnSync('bun', ['test', '--isolate', ...extraArgs, ...files], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {...process.env, TZ: 'utc', ...env},
  });
}

/**
 * Pull the per-file <testsuite> rows out of bun's JUnit output.
 *
 * Bun nests a testsuite per describe block, so only the rows whose name is a
 * test file path are real files; the rest are describe blocks and are ignored.
 */
function parseJUnit(xml) {
  const suites = new Map();
  const row = /<testsuite\b([^>]*)>/g;
  let match = row.exec(xml);
  while (match !== null) {
    const attrs = Object.fromEntries(
      [...match[1].matchAll(/(\w+)="([^"]*)"/g)].map(a => [a[1], a[2]]),
    );
    const name = attrs.name ?? '';
    if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      const index = name.indexOf('__tests__/');
      const rel = index >= 0 ? name.slice(index) : name;
      suites.set(rel, {
        tests: Number(attrs.tests ?? 0),
        failures: Number(attrs.failures ?? 0),
        errors: Number(attrs.errors ?? 0),
      });
    }
    match = row.exec(xml);
  }
  return suites;
}

/** Group the "Unhandled error between tests" blocks by their error line. */
function parseBlockingErrors(stdout) {
  const reasons = new Map();
  let current = null;
  for (const line of stdout.split('\n')) {
    const header = line.trim().match(/^(__tests__\/\S+\.(?:ts|tsx|js|jsx)):$/);
    if (header) {
      current = header[1];
      continue;
    }
    const error = line
      .trim()
      .match(/^(?:error|BuildMessage|\w*Error):\s*(.+)$/);
    if (error && current && !reasons.has(current)) {
      reasons.set(current, error[1].trim());
    }
  }
  return reasons;
}

function triage() {
  const files = discoverTestFiles();
  const dir = mkdtempSync(path.join(tmpdir(), 'kiroku-bun-triage-'));
  const xmlPath = path.join(dir, 'bun.xml');
  let result;
  try {
    result = runBun(files, [
      '--reporter=junit',
      `--reporter-outfile=${xmlPath}`,
    ]);
    if (result.error) {
      throw result.error;
    }
    const suites = parseJUnit(readFileSync(xmlPath, 'utf8'));
    // Bun writes the per-file error blocks to stderr, the summary to stdout.
    const reasons = parseBlockingErrors(
      `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    );
    const report = {clean: [], failing: [], blocked: []};
    for (const file of files) {
      const suite = suites.get(file);
      const reason = reasons.get(file);
      // A file that throws while loading sometimes still emits a JUnit row, so
      // neither signal alone is stable. Count what actually passed instead:
      // nothing passing means the file never really ran.
      const passed = suite ? suite.tests - suite.failures - suite.errors : 0;
      if (passed <= 0) {
        report.blocked.push({
          file,
          reason: reason ?? 'did not report any test',
        });
      } else if (reason || suite.failures > 0 || suite.errors > 0) {
        report.failing.push({file, reason: reason ?? 'test failure', ...suite});
      } else {
        report.clean.push({file, tests: suite.tests});
      }
    }
    return {files, report};
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

function summarize({files, report}) {
  const cleanTests = report.clean.reduce((sum, entry) => sum + entry.tests, 0);
  const pct = n => `${((n / files.length) * 100).toFixed(0)}%`;
  console.log(
    `\nbun test portability: ${files.length} files in the Jest suite\n`,
  );
  console.log(
    `  clean    ${String(report.clean.length).padStart(4)}  ${pct(report.clean.length)}   (${cleanTests} tests)`,
  );
  console.log(
    `  failing  ${String(report.failing.length).padStart(4)}  ${pct(report.failing.length)}`,
  );
  console.log(
    `  blocked  ${String(report.blocked.length).padStart(4)}  ${pct(report.blocked.length)}   (throws before any test runs)`,
  );

  const byReason = new Map();
  for (const {reason} of report.blocked) {
    byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
  }
  if (byReason.size > 0) {
    console.log('\n  why files are blocked:');
    for (const [reason, count] of [...byReason].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(count).padStart(4)}  ${reason}`);
    }
  }
  console.log(
    '\nSee contributingGuides/BUN_TEST.md for what these numbers mean.\n',
  );
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  if (args.help) {
    console.log(
      readFileSync(new URL(import.meta.url), 'utf8')
        .split('\n')
        .slice(1, 30)
        .join('\n'),
    );
    return;
  }

  const triaged = triage();

  if (args.list) {
    for (const entry of triaged.report[args.list]) {
      console.log(entry.file);
    }
    return;
  }
  if (args.json) {
    writeFileSync(args.json, `${JSON.stringify(triaged.report, null, 2)}\n`);
    console.log(`Wrote ${args.json}`);
  }
  if (args.run) {
    const clean = triaged.report.clean.map(entry => entry.file);
    if (clean.length === 0) {
      console.error('No bun-clean test files to run.');
      process.exit(1);
    }
    const run = runBun(clean, []);
    process.stdout.write(run.stdout ?? '');
    process.stderr.write(run.stderr ?? '');
    process.exit(run.status ?? 1);
  }

  summarize(triaged);
}

main();
