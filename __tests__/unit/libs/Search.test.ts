/**
 * @jest-environment node
 */

import {searchArrayByText, getNicknameMapping} from '@libs/Search';
import type {UserIDToNicknameMapping} from '@src/types/various/Search';

describe('searchArrayByText (multi-token AND refinement)', () => {
  const mapping: UserIDToNicknameMapping = {
    u1: 'John Doe',
    u2: 'Jane Doe',
    u3: 'John Smith',
  };
  const allIDs = ['u1', 'u2', 'u3'];

  it('matches a single word as a substring of the name', () => {
    expect(searchArrayByText(allIDs, 'doe', mapping)).toEqual(['u1', 'u2']);
  });

  it('narrows to the intersection when chained across words (AND)', () => {
    const afterDoe = searchArrayByText(allIDs, 'doe', mapping);
    expect(searchArrayByText(afterDoe, 'john', mapping)).toEqual(['u1']);
  });

  it('is order-independent across chained words', () => {
    const afterJohn = searchArrayByText(allIDs, 'john', mapping);
    expect(searchArrayByText(afterJohn, 'doe', mapping)).toEqual(['u1']);
  });

  it('returns the original array when the search text is empty', () => {
    expect(searchArrayByText(allIDs, '', mapping)).toEqual(allIDs);
  });

  it('drops ids that are missing from the mapping', () => {
    expect(searchArrayByText(['u1', 'unknown'], 'doe', mapping)).toEqual([
      'u1',
    ]);
  });
});

describe('getNicknameMapping', () => {
  it('maps user ids to their display names', () => {
    const result = getNicknameMapping({
      u1: {display_name: 'John Doe'},
      u2: {display_name: 'Jane Doe'},
    });
    expect(result).toEqual({u1: 'John Doe', u2: 'Jane Doe'});
  });
});
