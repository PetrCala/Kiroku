/* eslint-disable @typescript-eslint/naming-convention -- date keys */
import buildSessionCountsByDay from '@libs/Statistics/sessionCounts';
import type {DrinkingSessionList} from '@src/types/onyx';
import type {SelectedTimezone} from '@src/types/onyx/UserData';

const UTC = 'UTC' as SelectedTimezone;
const PRAGUE = 'Europe/Prague' as SelectedTimezone;

describe('buildSessionCountsByDay', () => {
  it('returns {} for undefined sessions', () => {
    expect(buildSessionCountsByDay(undefined, UTC)).toEqual({});
  });

  it('returns {} for empty sessions', () => {
    expect(buildSessionCountsByDay({}, UTC)).toEqual({});
  });

  it('buckets by session.start_time in UTC', () => {
    const sessions: DrinkingSessionList = {
      s1: {start_time: Date.UTC(2024, 0, 15, 10)},
      s2: {start_time: Date.UTC(2024, 0, 15, 23)},
      s3: {start_time: Date.UTC(2024, 0, 16, 9)},
    };
    expect(buildSessionCountsByDay(sessions, UTC)).toEqual({
      '2024-01-15': 2,
      '2024-01-16': 1,
    });
  });

  it('excludes ongoing sessions', () => {
    const sessions: DrinkingSessionList = {
      done: {start_time: Date.UTC(2024, 0, 15, 10)},
      live: {start_time: Date.UTC(2024, 0, 15, 22), ongoing: true},
    };
    expect(buildSessionCountsByDay(sessions, UTC)).toEqual({
      '2024-01-15': 1,
    });
  });

  it('honors per-session timezone over the argument timezone', () => {
    // 23:30 UTC on 2024-01-15 is 00:30 on 2024-01-16 in Prague (CET, UTC+1)
    const sessions: DrinkingSessionList = {
      traveled: {
        start_time: Date.UTC(2024, 0, 15, 23, 30),
        timezone: PRAGUE,
      },
    };
    expect(buildSessionCountsByDay(sessions, UTC)).toEqual({
      '2024-01-16': 1,
    });
  });

  it('skips invalid start_time values', () => {
    const sessions: DrinkingSessionList = {
      bad: {start_time: Number.NaN},
      good: {start_time: Date.UTC(2024, 0, 15, 10)},
    };
    expect(buildSessionCountsByDay(sessions, UTC)).toEqual({
      '2024-01-15': 1,
    });
  });
});
