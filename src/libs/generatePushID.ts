/* eslint-disable no-bitwise */
import {getRandomBytes} from 'expo-crypto';

/**
 * Local re-implementation of Firebase's `generatePushID` (Michael Lehenbauer's
 * canonical algorithm). Produces 20-character, lexicographically-sortable keys
 * that are format-compatible with the Firebase RTDB push IDs every existing
 * drinking-session key already uses, WITHOUT touching the Firebase `db` handle.
 * This severs the last RTDB-handle dependency on the session write path; see
 * contributingGuides/REALTIME_MIGRATION_AUDIT.md (category A).
 *
 * Key layout (20 chars over the 64-char, sort-order-preserving alphabet below):
 *   - chars 0–7:  `Date.now()` (ms) encoded big-endian → keys sort by creation time.
 *   - chars 8–19: 72 bits of randomness (secure RNG) → collision resistance.
 *
 * Two IDs minted in the same millisecond stay strictly ordered: the 72-bit random
 * suffix from the previous call is incremented by one (with carry) rather than
 * re-rolled, so a burst within a single ms remains monotonically increasing.
 */

// Modeled after the Firebase JS SDK. The ordering of this alphabet is load-bearing:
// ASCII '-' < digits < uppercase < '_' < lowercase, so lexicographic string order
// equals chronological order.
const PUSH_CHARS =
  '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

// Timestamp of the last push, used to detect collisions within the same millisecond.
let lastPushTime = 0;

// The 12 random "digits" (each 0–63) from the previous call. On a same-ms collision
// they are incremented (not re-randomized) to preserve strict ordering.
const lastRandChars: number[] = new Array<number>(12).fill(0);

/**
 * Refill `lastRandChars` with 12 fresh 6-bit values (0–63) derived from 72 bits of
 * secure randomness (`expo-crypto`). The 9 random bytes are read as a single
 * big-endian 72-bit stream and sliced into 12 six-bit chunks (9 × 8 === 12 × 6).
 */
function rerollRandChars(): void {
  const bytes = getRandomBytes(9);
  for (let i = 0; i < 12; i++) {
    const bitPos = i * 6;
    const bytePos = bitPos >> 3;
    const bitOffset = bitPos & 7;
    const hi = bytes[bytePos];
    const lo = bytePos + 1 < bytes.length ? bytes[bytePos + 1] : 0;
    // Pull the 6 bits starting at `bitOffset` out of the 16-bit [hi|lo] window.
    const bits = (hi << 8) | lo;
    lastRandChars[i] = (bits >> (10 - bitOffset)) & 0x3f;
  }
}

/**
 * Generate a new Firebase-push-ID-compatible 20-character key.
 *
 * @returns A 20-char key whose lexicographic order matches creation order.
 */
function generatePushID(): string {
  let now = Date.now();
  const duplicateTime = now === lastPushTime;
  lastPushTime = now;

  const timeStampChars = new Array<string>(8);
  for (let i = 7; i >= 0; i--) {
    timeStampChars[i] = PUSH_CHARS.charAt(now % 64);
    now = Math.floor(now / 64);
  }
  if (now !== 0) {
    throw new Error('generatePushID: timestamp did not fully convert');
  }

  let id = timeStampChars.join('');

  if (!duplicateTime) {
    rerollRandChars();
  } else {
    // Same millisecond as the previous ID: increment the 72-bit random suffix by
    // one (with carry) so the new ID still sorts strictly after the last one.
    let i = 11;
    for (; i >= 0 && lastRandChars[i] === 63; i--) {
      lastRandChars[i] = 0;
    }
    if (i >= 0) {
      lastRandChars[i]++;
    } else {
      // Astronomically unlikely (>2^72 IDs in one ms): every digit rolled over.
      // Reroll rather than emit a wrapped, non-monotonic suffix.
      rerollRandChars();
    }
  }

  for (let i = 0; i < 12; i++) {
    id += PUSH_CHARS.charAt(lastRandChars[i]);
  }

  if (id.length !== 20) {
    throw new Error('generatePushID: generated id length is not 20');
  }

  return id;
}

export default generatePushID;
