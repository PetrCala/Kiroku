/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';

/**
 * Mechanical half of `contributingGuides/COPY_VOICE.md`.
 *
 * The guide's shape rules (headline is a sentence, no verbless fragments, no
 * UI vocabulary) need a reader and stay a review-time concern. What is left is
 * deterministic, and every one of these rules was already written down and
 * broken at least once, so they are worth a gate:
 *
 * - no em/en dashes in anything a user reads,
 * - no vouching for ourselves in store copy,
 * - store notes that fit the console's paste limit.
 */

const REPO_ROOT = path.resolve(__dirname, '../..');

/** Everything a user reads: UI strings plus the two store listings. */
const UI_STRING_FILES = ['src/languages/en.ts', 'src/languages/cs_cz.ts'];
const STORE_COPY_DIRS = [
  'fastlane/metadata',
  'fastlane/appstore-release-notes',
  'fastlane/play-release-notes',
];

/** COPY_VOICE.md, "Things we never do": telling people how sincere we are. */
const SINCERITY_WORDS =
  /\b(genuinely|truly|honestly|nobody judges|no judgement|judgment-free)\b/i;

/** Google Play rejects a paste over 500; the App Store cuts off at 4000. */
const PLAY_NOTE_LIMIT = 500;
const APPSTORE_NOTE_LIMIT = 4000;

function walk(dir: string): string[] {
  const absolute = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(absolute)) {
    return [];
  }
  return fs
    .readdirSync(absolute, {recursive: true, withFileTypes: true})
    .filter(entry => entry.isFile() && entry.name.endsWith('.txt'))
    .map(entry =>
      path.relative(REPO_ROOT, path.join(entry.parentPath, entry.name)),
    );
}

const storeCopyFiles = STORE_COPY_DIRS.flatMap(walk);
const read = (file: string) =>
  fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');

describe('Copy voice', () => {
  it('finds the store copy it is meant to check', () => {
    // A rename or a moved folder must fail loudly rather than pass vacuously.
    expect(storeCopyFiles.length).toBeGreaterThan(0);
  });

  it.each([...UI_STRING_FILES, ...storeCopyFiles])(
    '%s has no em or en dashes',
    file => {
      const offenders = read(file)
        .split('\n')
        .map((line, index) => ({line, number: index + 1}))
        .filter(({line}) => /[\u2013\u2014]/.test(line));

      if (offenders.length > 0) {
        const detail = offenders
          .map(({line, number}) => `   ${number}: ${line.trim()}`)
          .join('\n');
        console.debug(
          `🏹 ${file}: use two short sentences, a comma, or parentheses instead.\n${detail}`,
        );
      }
      expect(offenders).toHaveLength(0);
    },
  );

  it.each(storeCopyFiles)('%s does not vouch for us', file => {
    expect(read(file)).not.toMatch(SINCERITY_WORDS);
  });

  it.each(
    storeCopyFiles.filter(file =>
      file.startsWith('fastlane/play-release-notes'),
    ),
  )('%s fits the Play Console paste limit', file => {
    expect([...read(file)].length).toBeLessThanOrEqual(PLAY_NOTE_LIMIT);
  });

  it.each(
    storeCopyFiles.filter(file =>
      file.startsWith('fastlane/appstore-release-notes'),
    ),
  )("%s fits the App Store What's New limit", file => {
    expect([...read(file)].length).toBeLessThanOrEqual(APPSTORE_NOTE_LIMIT);
  });
});
