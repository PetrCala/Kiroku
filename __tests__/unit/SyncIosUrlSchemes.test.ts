/**
 * @jest-environment node
 */

/**
 * Guards `scripts/sync-ios-url-schemes.mjs`, which keeps the Google Sign-In
 * URL schemes in ios/kiroku/Info.plist equal to the REVERSED_CLIENT_ID of the
 * three GoogleService-Info plists.
 *
 * The last test is the one that matters day to day: it runs `--check` against
 * the real repo, so a regenerated Firebase config that nobody propagated into
 * Info.plist fails `npm test` instead of failing silently at sign-in.
 *
 * The script is an ESM `.mjs` outside the Jest transform, so it is exercised
 * as a child process rather than imported.
 */

import {execFileSync} from 'child_process';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'fs';
import {tmpdir} from 'os';
import {join} from 'path';

const REPO_ROOT = join(__dirname, '..', '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'sync-ios-url-schemes.mjs');
const INFO_PLIST = join('ios', 'kiroku', 'Info.plist');

type RunResult = {status: number; output: string};

function run(args: string[]): RunResult {
  try {
    const output = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return {status: 0, output};
  } catch (error) {
    const failure = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      status: failure.status ?? 1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
    };
  }
}

/** A throwaway copy of the four files the script touches. */
function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'url-schemes-'));
  cpSync(join(REPO_ROOT, 'ios', 'config'), join(root, 'ios', 'config'), {
    recursive: true,
  });
  cpSync(join(REPO_ROOT, INFO_PLIST), join(root, INFO_PLIST), {
    recursive: true,
  });
  return root;
}

function readInfoPlist(root: string): string {
  return readFileSync(join(root, INFO_PLIST), 'utf8');
}

function writeInfoPlist(root: string, content: string): void {
  writeFileSync(join(root, INFO_PLIST), content);
}

function schemesIn(content: string): string[] {
  const array = content.match(
    /<key>CFBundleURLSchemes<\/key>\s*\n\s*<array>\n([\s\S]*?)\n\s*<\/array>/,
  );
  if (!array) {
    return [];
  }
  return [...array[1].matchAll(/<string>([^<]*)<\/string>/g)].map(
    match => match[1],
  );
}

describe('scripts/sync-ios-url-schemes', () => {
  let root: string;

  beforeEach(() => {
    root = makeFixture();
  });

  afterEach(() => {
    rmSync(root, {recursive: true, force: true});
  });

  it('reports no drift on an untouched checkout', () => {
    const result = run(['--check', '--root', root]);

    expect(result.status).toBe(0);
    expect(result.output).toContain('is in sync');
  });

  it('exits non-zero when a scheme drifts', () => {
    writeInfoPlist(
      root,
      readInfoPlist(root).replace(
        'com.googleusercontent.apps.806896865950-getgjeb0ncgggrri39ckm2ij2ntfljfp',
        'com.googleusercontent.apps.806896865950-stale',
      ),
    );

    const result = run(['--check', '--root', root]);

    expect(result.status).toBe(1);
    expect(result.output).toContain('out of sync');
  });

  it('rewrites a drifted array back to the plist values, in prod/dev/adhoc order', () => {
    const original = readInfoPlist(root);
    writeInfoPlist(
      root,
      original.replace(
        'com.googleusercontent.apps.806896865950-getgjeb0ncgggrri39ckm2ij2ntfljfp',
        'com.googleusercontent.apps.806896865950-stale',
      ),
    );

    expect(run(['--root', root]).status).toBe(0);

    // Byte-identical, not merely equivalent: the rewrite must preserve the
    // file's tabs so it never shows up as unrelated diff noise.
    expect(readInfoPlist(root)).toBe(original);
  });

  it('restores the order when the array is shuffled', () => {
    const original = readInfoPlist(root);
    const [prod, dev, adhoc] = schemesIn(original);
    writeInfoPlist(
      root,
      original
        .replace(`<string>${prod}</string>`, '<string>__A__</string>')
        .replace(`<string>${dev}</string>`, '<string>__B__</string>')
        .replace(`<string>${adhoc}</string>`, `<string>${prod}</string>`)
        .replace('<string>__A__</string>', `<string>${adhoc}</string>`)
        .replace('<string>__B__</string>', `<string>${dev}</string>`),
    );

    expect(run(['--root', root]).status).toBe(0);
    expect(schemesIn(readInfoPlist(root))).toEqual([prod, dev, adhoc]);
  });

  it('keeps a non-Google scheme that shares the array', () => {
    const original = readInfoPlist(root);
    const [prod] = schemesIn(original);
    writeInfoPlist(
      root,
      original.replace(
        `<string>${prod}</string>`,
        `<string>kiroku</string>\n\t\t\t\t<string>${prod}</string>`,
      ),
    );

    expect(run(['--root', root]).status).toBe(0);
    expect(schemesIn(readInfoPlist(root)).at(-1)).toBe('kiroku');
  });

  it('refuses a config whose CLIENT_ID and REVERSED_CLIENT_ID disagree', () => {
    const configPath = join(
      root,
      'ios',
      'config',
      'GoogleService-Info.dev.plist',
    );
    const config = readFileSync(configPath, 'utf8');
    writeFileSync(
      configPath,
      config.replace(
        /(<key>REVERSED_CLIENT_ID<\/key>\s*<string>)[^<]*/,
        '$1com.googleusercontent.apps.806896865950-handedited',
      ),
    );

    const result = run(['--check', '--root', root]);

    expect(result.status).toBe(1);
    expect(result.output).toContain('disagree');
    // The drift report must not fire instead. A hand-edited config is a
    // different failure and silently "fixing" Info.plist would cement it.
    expect(result.output).not.toContain('out of sync');
  });

  it('refuses two configs that share an OAuth client', () => {
    const configDir = join(root, 'ios', 'config');
    cpSync(
      join(configDir, 'GoogleService-Info.dev.plist'),
      join(configDir, 'GoogleService-Info.adhoc.plist'),
    );

    const result = run(['--check', '--root', root]);

    expect(result.status).toBe(1);
    expect(result.output).toContain('share REVERSED_CLIENT_ID');
  });

  it('the committed Info.plist matches the committed Firebase configs', () => {
    const result = run(['--check']);

    expect(result.status).toBe(0);
  });
});
