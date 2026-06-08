/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

import {getRandomBytes} from 'expo-crypto';
import generatePushID from '@libs/generatePushID';

// The 64-char, sort-order-preserving Firebase push-ID alphabet, kept in lockstep
// with the generator under test. The ordering is load-bearing: lexicographic
// string order must equal chronological order.
const PUSH_CHARS =
  '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
const ALPHABET = new Set(PUSH_CHARS.split(''));

// A fixed UTC instant the fake clock starts from in each test.
const START_MS = new Date('2026-01-01T00:00:00.000Z').getTime();

// Mock the secure RNG with a deterministic, per-call-varying byte source so the
// random suffix exercises a spread of alphabet chars without making the test
// flaky. The generator only calls this when minting in a fresh millisecond.
jest.mock('expo-crypto', () => ({
  __esModule: true,
  getRandomBytes: jest.fn(),
}));

const mockedGetRandomBytes = jest.mocked(getRandomBytes);

beforeEach(() => {
  jest.setSystemTime(START_MS);
  let counter = 0;
  mockedGetRandomBytes.mockImplementation((byteCount: number) => {
    const out = new Uint8Array(byteCount);
    for (let i = 0; i < byteCount; i += 1) {
      // Deterministic but varied across calls and byte positions.
      out[i] = (counter * 37 + i * 53) % 256;
    }
    counter += 1;
    return out;
  });
});

describe('generatePushID', () => {
  it('produces a 20-character key drawn only from the push-ID alphabet', () => {
    const id = generatePushID();
    expect(id).toHaveLength(20);
    expect(Array.from(id).every(ch => ALPHABET.has(ch))).toBe(true);
  });

  it('only ever emits in-alphabet characters across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      jest.advanceTimersByTime(7);
      const id = generatePushID();
      expect(id).toHaveLength(20);
      Array.from(id).forEach(ch => seen.add(ch));
    }
    expect(Array.from(seen).every(ch => ALPHABET.has(ch))).toBe(true);
  });

  it('is strictly lexicographically increasing as time advances (time-sortable)', () => {
    const ids: string[] = [];
    for (let i = 0; i < 100; i += 1) {
      jest.advanceTimersByTime(1 + (i % 5));
      ids.push(generatePushID());
    }
    // Default string sort is by UTF-16 code unit, which for this ASCII alphabet
    // equals the intended lexicographic (== chronological) order.
    expect(ids).toEqual([...ids].sort());
    // Strictly increasing: no two keys are equal.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps strict ordering for keys minted in the same millisecond', () => {
    // Pin Date.now() directly rather than leaning on jest.setSystemTime: the global
    // setup (jest/setupAfterEnv.ts) calls jest.useRealTimers(), which defeats the
    // file's fake clock, so Date.now() would otherwise return real wall-clock time.
    // Three synchronous calls could then straddle a millisecond boundary on a loaded
    // CI runner, flipping the timestamp prefix and failing the prefix assertions.
    // Freezing Date.now() guarantees an identical millisecond and exercises the
    // monotonic-increment path (random suffix incremented, not re-rolled).
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(START_MS);
    try {
      const a = generatePushID();
      const b = generatePushID();
      const c = generatePushID();
      expect(a < b).toBe(true);
      expect(b < c).toBe(true);
      // Same-millisecond keys share the 8-char timestamp prefix.
      expect(b.slice(0, 8)).toBe(a.slice(0, 8));
      expect(c.slice(0, 8)).toBe(a.slice(0, 8));
    } finally {
      nowSpy.mockRestore();
    }
  });
});
