/**
 * @jest-environment node
 */
import HttpsError from '@libs/Errors/HttpsError';
import {
  getInviteErrorKind,
  getInviteLink,
  isPendingInviteFresh,
  normalizeInviteCode,
} from '@libs/FriendInviteUtils';
import CONST from '@src/CONST';

describe('normalizeInviteCode', () => {
  it('trims and lowercases a valid code', () => {
    expect(normalizeInviteCode('  ABCD234567 ')).toBe('abcd234567');
  });

  it.each([
    ['too short', 'abc234'],
    ['too long', 'abcd2345678'],
    ['look-alike 0', 'abcd23450x'],
    ['look-alike 1', 'abcd23451x'],
    ['look-alike l', 'abcd2345lx'],
    ['look-alike o', 'abcd2345ox'],
    ['path characters', 'abcd/23456'],
    ['empty', ''],
  ])('rejects %s', (_label, raw) => {
    expect(normalizeInviteCode(raw)).toBeUndefined();
  });

  it('rejects non-strings (a missing route param)', () => {
    expect(normalizeInviteCode(undefined)).toBeUndefined();
    expect(normalizeInviteCode(1234567890)).toBeUndefined();
  });
});

describe('getInviteLink', () => {
  it('builds the app.kiroku.cz link the QR code encodes', () => {
    expect(getInviteLink('abcd234567')).toBe(
      'https://app.kiroku.cz/add/abcd234567',
    );
  });
});

describe('isPendingInviteFresh', () => {
  const now = 1_800_000_000_000;

  it('keeps a link opened recently', () => {
    expect(
      isPendingInviteFresh({code: 'abcd234567', createdAt: now - 1000}, now),
    ).toBe(true);
  });

  it('drops a link older than the TTL', () => {
    const createdAt = now - CONST.FRIEND_INVITE.PENDING_TTL_MS;
    expect(isPendingInviteFresh({code: 'abcd234567', createdAt}, now)).toBe(
      false,
    );
  });

  it('drops a timestamp from the future (clock changed)', () => {
    expect(
      isPendingInviteFresh({code: 'abcd234567', createdAt: now + 1000}, now),
    ).toBe(false);
  });

  it('treats nothing stashed as not fresh', () => {
    expect(isPendingInviteFresh(undefined, now)).toBe(false);
  });
});

describe('getInviteErrorKind', () => {
  const httpError = (status: number) =>
    new HttpsError({message: 'x', status: String(status)});

  it.each([
    [404, 'invalid'],
    [400, 'ownInvite'],
    [403, 'unavailable'],
    [429, 'failed'],
    [500, 'failed'],
  ])('maps HTTP %s to %s', (status, kind) => {
    expect(getInviteErrorKind(httpError(status))).toBe(kind);
  });

  it('treats network failures and anything else as failed', () => {
    expect(getInviteErrorKind(new Error('offline'))).toBe('failed');
    expect(getInviteErrorKind(undefined)).toBe('failed');
  });
});
