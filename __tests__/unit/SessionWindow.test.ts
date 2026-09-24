import {
  getBootSessionsFrom,
  getSnapshotSessionsFrom,
  isLoadedFrom,
  noteLoadedBackTo,
  noteSnapshotWindow,
  resetSessionWindows,
} from '@libs/SessionWindow';
import CONST from '@src/CONST';

const UID = 'u1';
// A mid-month "now", so the floor visibly snaps to a month start.
const NOW = new Date(2026, 8, 23, 15, 30);

describe('SessionWindow', () => {
  beforeEach(() => {
    resetSessionWindows();
  });

  it('boots from the start of the month SESSIONS_INITIAL_FETCH_MONTHS back', () => {
    expect(CONST.SESSIONS_INITIAL_FETCH_MONTHS).toBe(3);
    expect(getBootSessionsFrom(NOW)).toBe(new Date(2026, 5, 1).getTime());
  });

  it('knows nothing about a user until a snapshot or a read is noted', () => {
    expect(isLoadedFrom(UID, getBootSessionsFrom(NOW))).toBe(false);
    expect(getSnapshotSessionsFrom(UID, NOW)).toBe(getBootSessionsFrom(NOW));
    expect(getSnapshotSessionsFrom(undefined, NOW)).toBe(
      getBootSessionsFrom(NOW),
    );
  });

  it('covers every window at or above the noted floor', () => {
    const boot = getBootSessionsFrom(NOW);
    noteSnapshotWindow(UID, boot);
    expect(isLoadedFrom(UID, boot)).toBe(true);
    expect(isLoadedFrom(UID, boot + 1)).toBe(true);
    expect(isLoadedFrom(UID, boot - 1)).toBe(false);
    expect(isLoadedFrom('someone-else', boot)).toBe(false);
  });

  it('only ever deepens on a read, but a snapshot replaces', () => {
    noteSnapshotWindow(UID, 3000);
    noteLoadedBackTo(UID, 5000);
    expect(isLoadedFrom(UID, 3000)).toBe(true);
    noteLoadedBackTo(UID, 1000);
    expect(isLoadedFrom(UID, 1000)).toBe(true);
    noteSnapshotWindow(UID, 2000);
    expect(isLoadedFrom(UID, 1000)).toBe(false);
    expect(isLoadedFrom(UID, 2000)).toBe(true);
  });

  it('asks a re-baseline for the deeper of the boot floor and what is loaded', () => {
    const boot = getBootSessionsFrom(NOW);
    noteLoadedBackTo(UID, boot + 1);
    expect(getSnapshotSessionsFrom(UID, NOW)).toBe(boot);
    noteLoadedBackTo(UID, boot - 10);
    expect(getSnapshotSessionsFrom(UID, NOW)).toBe(boot - 10);
  });
});
