import {subYears} from 'date-fns';
import type {Comparison, Range} from '@components/StatsContextProvider/types';

type ShiftedRange = {start: Date; end: Date};

/**
 * Derive the comparison window for a given `range` and `comparison` mode.
 *
 *   - `'none'`              → null (no comparison series rendered)
 *   - `'previous-period'`   → window of equal length placed immediately
 *                              before `range.start`. The comparison's `end`
 *                              is `range.start - 1ms` so the two windows
 *                              are disjoint.
 *   - `'previous-year'`     → both endpoints shifted back by one calendar
 *                              year via date-fns `subYears`. Leap day handling
 *                              follows date-fns: Feb 29 shifts to Feb 28.
 *
 * `'All'` ranges are valid input — callers (the toolbar) typically gate the
 * comparison toggle to non-`All` presets, but this helper does not enforce it
 * and will happily return a previous window for `All` too.
 */
function shiftRange(range: Range, comparison: Comparison): ShiftedRange | null {
  if (comparison === 'none') {
    return null;
  }
  if (comparison === 'previous-year') {
    return {
      start: subYears(range.start, 1),
      end: subYears(range.end, 1),
    };
  }
  const length = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - length - 1),
    end: new Date(range.start.getTime() - 1),
  };
}

export default shiftRange;
export type {ShiftedRange};
