import fs from 'fs';
import path from 'path';

/**
 * `firebase.json` is not only a Firebase Hosting config: it is also read at
 * *iOS build time* by `@react-native-firebase/app/ios_config.sh`, the
 * `[CP-User] [RNFB] Core Configuration` Xcode build phase.
 *
 * That script interpolates the raw file contents into a Ruby SINGLE-QUOTED
 * string literal:
 *
 *     ruby -Ku -e "require 'json'; output=JSON.parse('$_JSON_OUTPUT_RAW'); ..."
 *
 * Inside a Ruby single-quoted literal `\\` is an escape for one literal
 * backslash, so every JSON-escaped backslash is collapsed before JSON.parse
 * ever sees it: `"^/canvaskit\\.wasm$"` in the file arrives as
 * `"^/canvaskit\.wasm$"`, and `\.` is not a valid JSON string escape. The
 * `json` gem tolerated unknown escapes before 2.10 and rejects them from 2.10
 * on, so on current runners the phase exits 1 with
 * "error: Failed to parse firebase.json" and the archive fails.
 *
 * A backslash in `firebase.json` therefore breaks every iOS build, while web
 * deploys and every JS check stay green — which makes it very easy to land.
 * This test is the cheap guard: it fails in `test.yml` in seconds instead of
 * 30 minutes into an iOS archive.
 *
 * If you need a literal dot in a hosting `regex` rule, write the RE2 character
 * class `[.]` rather than `\\.`. The two are equivalent in RE2, and `[.]`
 * needs no backslash.
 */
describe('firebase.json', () => {
  const firebaseJsonPath = path.resolve(__dirname, '..', '..', 'firebase.json');
  const raw = fs.readFileSync(firebaseJsonPath, 'utf8');

  it('is valid JSON', () => {
    expect(() => JSON.parse(raw) as unknown).not.toThrow();
  });

  it('contains no backslashes, which the RNFB iOS build phase cannot parse', () => {
    const offendingLines = raw
      .split('\n')
      .map((line, index) => ({line, lineNumber: index + 1}))
      .filter(({line}) => line.includes('\\'));

    expect(offendingLines).toEqual([]);
  });

  it('survives the Ruby single-quote collapsing that ios_config.sh applies', () => {
    // Emulate the Ruby single-quoted literal: each `\\` becomes `\`.
    const asRubySees = raw.replace(/\\\\/g, '\\');

    expect(() => JSON.parse(asRubySees) as unknown).not.toThrow();
  });
});
