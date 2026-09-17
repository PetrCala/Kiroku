/**
 * @jest-environment node
 */

import * as ValidationUtils from '@libs/ValidationUtils';
import CONST from '@src/CONST';

describe('isValidSessionNote', () => {
  it('accepts a note up to the note limit', () => {
    const limit = CONST.SESSION_NOTE_CHARACTER_LIMIT;
    expect(ValidationUtils.isValidSessionNote('a'.repeat(limit))).toBe(true);
    expect(ValidationUtils.isValidSessionNote('a'.repeat(limit + 1))).toBe(
      false,
    );
  });

  it('is no longer capped at the shorter session-name limit', () => {
    expect(
      ValidationUtils.isValidSessionNote(
        'a'.repeat(CONST.SESSION_NAME_CHARACTER_LIMIT + 1),
      ),
    ).toBe(true);
  });
});

describe('isValidSessionName', () => {
  it('accepts a name up to the name limit', () => {
    const limit = CONST.SESSION_NAME_CHARACTER_LIMIT;
    expect(ValidationUtils.isValidSessionName('a'.repeat(limit))).toBe(true);
    expect(ValidationUtils.isValidSessionName('a'.repeat(limit + 1))).toBe(
      false,
    );
  });

  it('accepts the generated default name', () => {
    expect(ValidationUtils.isValidSessionName('Friday evening')).toBe(true);
  });

  it('rejects profanity, like a display name does', () => {
    const profane = 'fucking evening';
    expect(ValidationUtils.isValidSessionName(profane)).toBe(false);
    expect(ValidationUtils.isValidDisplayName(profane)).toBe(false);
  });
});
