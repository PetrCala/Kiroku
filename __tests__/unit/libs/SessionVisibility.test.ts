/**
 * @jest-environment node
 */

import {
  getSessionVisibility,
  isSessionPrivate,
  visibilityFromIsPrivate,
} from '@libs/SessionVisibility';
import CONST from '@src/CONST';
import type {DrinkingSession} from '@src/types/onyx';

const TS = 1_700_000_000_000;
const session = (extra: Partial<DrinkingSession> = {}): DrinkingSession => ({
  start_time: TS,
  ...extra,
});

describe('getSessionVisibility', () => {
  it('reads an explicit visibility', () => {
    expect(getSessionVisibility(session({visibility: 'private'}))).toBe(
      CONST.SESSION.VISIBILITY.PRIVATE,
    );
    expect(getSessionVisibility(session({visibility: 'friends'}))).toBe(
      CONST.SESSION.VISIBILITY.FRIENDS,
    );
  });

  it('defaults to friends without one, like the server does', () => {
    expect(getSessionVisibility(session())).toBe(
      CONST.SESSION.VISIBILITY.FRIENDS,
    );
    expect(getSessionVisibility(undefined)).toBe(
      CONST.SESSION.VISIBILITY.FRIENDS,
    );
  });
});

describe('isSessionPrivate', () => {
  it('is true only for a session marked private', () => {
    expect(isSessionPrivate(session({visibility: 'private'}))).toBe(true);
    expect(isSessionPrivate(session({visibility: 'friends'}))).toBe(false);
    expect(isSessionPrivate(session())).toBe(false);
    expect(isSessionPrivate(undefined)).toBe(false);
  });
});

describe('visibilityFromIsPrivate', () => {
  it('maps the toggle position onto the stored value', () => {
    expect(visibilityFromIsPrivate(true)).toBe(
      CONST.SESSION.VISIBILITY.PRIVATE,
    );
    expect(visibilityFromIsPrivate(false)).toBe(
      CONST.SESSION.VISIBILITY.FRIENDS,
    );
  });
});
