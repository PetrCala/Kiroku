/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

/**
 * The session timeline (Sessions v2 W2 capture UI): every drink in the
 * session, in the order it happened, each row naming the drink it is about.
 *
 * What this pins down is the thing entries buy over `drinks[timestamp]`
 * buckets. A bucket is a count with no identity, so the old UI could only say
 * "4 beers" and let you take one off the end. Here a row knows its own time,
 * serving, source and id, so it can be edited or deleted by name (RFC §4.3,
 * decision 1).
 */
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react-native';
import SessionTimeline from '@components/DrinkingSessionWindow/SessionTimeline';
import * as DS from '@userActions/DrinkingSession';
import CONST from '@src/CONST';
import type {DrinkingSession} from '@src/types/onyx';
import type {SessionEntry} from '@src/types/onyx/SessionEntries';

jest.mock('@userActions/DrinkingSession', () => ({
  removeSessionEntry: jest.fn(),
  editSessionEntry: jest.fn(),
}));

// The theme/style hooks reach the whole design system; the timeline only needs
// style objects to spread, so hand it empty ones.
jest.mock('@hooks/useThemeStyles', () => ({
  __esModule: true,
  default: () =>
    new Proxy(
      {},
      {
        get: (_target, key) =>
          typeof key === 'string' && key.startsWith('Symbol') ? undefined : {},
      },
    ),
}));

jest.mock('@hooks/useTheme', () => ({
  __esModule: true,
  default: () => ({text: '#000000'}),
}));

// Localize is stubbed to the key plus its params, so an assertion can name the
// string a row shows without depending on the English copy.
jest.mock('@hooks/useLocalize', () => ({
  __esModule: true,
  default: () => ({
    translate: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

// The real Button reaches react-native-reanimated, whose native side is not
// initialized under jest. The timeline only needs something pressable.
jest.mock('@components/Button', () => {
  const {Text, TouchableOpacity} = require('react-native') as {
    Text: React.ComponentType<{children?: React.ReactNode}>;
    TouchableOpacity: React.ComponentType<{
      onPress?: () => void;
      testID?: string;
      accessibilityLabel?: string;
      children?: React.ReactNode;
    }>;
  };
  return {
    __esModule: true,
    default: ({
      onPress,
      testID,
      accessibilityLabel,
      text,
    }: {
      onPress?: () => void;
      testID?: string;
      accessibilityLabel?: string;
      text?: string;
    }) => (
      <TouchableOpacity
        onPress={onPress}
        testID={testID}
        accessibilityLabel={accessibilityLabel}>
        <Text>{text ?? ''}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@components/Icon', () => {
  const {View} = require('react-native') as {
    View: React.ComponentType<{testID?: string}>;
  };
  return {__esModule: true, default: () => <View testID="drink-icon" />};
});

// PopoverMenu drags in the modal/measurement stack. Render its items inline so
// a test can press one; the menu's own behaviour is not what is under test.
jest.mock('@components/PopoverMenu', () => {
  const {Text, TouchableOpacity, View} = require('react-native') as {
    Text: React.ComponentType<{children?: React.ReactNode}>;
    TouchableOpacity: React.ComponentType<{
      onPress?: () => void;
      testID?: string;
      accessibilityRole?: string;
      children?: React.ReactNode;
    }>;
    View: React.ComponentType<{children?: React.ReactNode}>;
  };
  return {
    __esModule: true,
    default: ({
      isVisible,
      menuItems,
    }: {
      isVisible: boolean;
      menuItems: Array<{text: string; onSelected?: () => void}>;
    }) =>
      isVisible ? (
        <View>
          {menuItems.map(item => (
            <TouchableOpacity
              key={item.text}
              testID={`menu-${item.text}`}
              accessibilityRole="button"
              onPress={() => item.onSelected?.()}>
              <Text>{item.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null,
  };
});

jest.mock('@components/DrinkingSessionWindow/EditEntryModal', () => {
  const {View} = require('react-native') as {
    View: React.ComponentType<{testID?: string}>;
  };
  return {
    __esModule: true,
    default: ({entry}: {entry: {id: string}}) => (
      <View testID={`editing-${entry.id}`} />
    ),
  };
});

const UID = 'uid-A';
// 2023-11-14 20:00 UTC, so the Prague wall clock is 21:00.
const START = Date.UTC(2023, 10, 14, 20, 0, 0);

function drinkEntry(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    ts: START,
    key: 'beer',
    count: 1,
    source: CONST.SESSION.ENTRY_SOURCE.PHONE,
    author_uid: UID,
    target_uid: UID,
    created_at: START,
    ...overrides,
  };
}

function session(entries: Record<string, SessionEntry>): DrinkingSession {
  return {
    id: '-Nsession1',
    schema_version: CONST.SESSION.SCHEMA_VERSION,
    start_time: START,
    end_time: START,
    blackout: false,
    note: '',
    timezone: 'Europe/Prague',
    type: CONST.SESSION.TYPES.LIVE,
    ongoing: true,
    entries,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SessionTimeline', () => {
  it('lists every live entry oldest first, whatever order the map is in', () => {
    render(
      <SessionTimeline
        session={session({
          late: drinkEntry({ts: START + 120_000}),
          early: drinkEntry({ts: START}),
          middle: drinkEntry({ts: START + 60_000}),
        })}
      />,
    );

    // The row ids, not the per-row options buttons that share the prefix.
    const rows = screen.getAllByTestId(/^timeline-entry-(?!options-)/);
    const rowIds = rows.map(row => (row.props as {testID: string}).testID);
    expect(rowIds).toEqual([
      'timeline-entry-early',
      'timeline-entry-middle',
      'timeline-entry-late',
    ]);
  });

  it('leaves tombstones out, and says so when nothing is left', () => {
    render(
      <SessionTimeline
        session={session({gone: drinkEntry({deleted: true})})}
      />,
    );
    expect(screen.queryByTestId('timeline-entry-gone')).toBeNull();
    expect(screen.getByTestId('session-timeline-empty')).toBeTruthy();
  });

  it('shows each entry time on the session timezone, not the device', () => {
    render(<SessionTimeline session={session({e1: drinkEntry()})} />);
    // 20:00 UTC is 21:00 in Prague; a device-local render would show another
    // hour depending on where the test runs.
    expect(screen.getByText('21:00')).toBeTruthy();
  });

  it('points out a watch drink and stays quiet about a phone one', () => {
    render(
      <SessionTimeline
        session={session({
          fromWatch: drinkEntry({source: CONST.SESSION.ENTRY_SOURCE.WATCH}),
          fromPhone: drinkEntry({ts: START + 60_000}),
        })}
      />,
    );
    expect(screen.getByTestId('timeline-source-fromWatch')).toBeTruthy();
    expect(screen.queryByTestId('timeline-source-fromPhone')).toBeNull();
  });

  it('shows a serving the entry chose and hides one that is the default', () => {
    render(
      <SessionTimeline
        session={session({
          custom: drinkEntry({volume_ml: 400, abv: 0.07}),
          plain: drinkEntry({ts: START + 60_000}),
        })}
      />,
    );
    // 0.07 renders as 7 percent, not 0.07.
    expect(
      screen.getByText('liveSessionScreen.serving:{"ml":400,"abv":7}'),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        `liveSessionScreen.serving:{"ml":${CONST.DRINK_DEFAULTS.beer.ml},"abv":5}`,
      ),
    ).toBeNull();
  });

  it('shows how many drinks an entry stands for only when it is more than one', () => {
    render(
      <SessionTimeline
        session={session({
          many: drinkEntry({count: 3}),
          one: drinkEntry({ts: START + 60_000}),
        })}
      />,
    );
    expect(
      screen.getByText(/liveSessionScreen.entryMultiplier:{"count":3}/),
    ).toBeTruthy();
    expect(screen.queryByText(/entryMultiplier:{"count":1}/)).toBeNull();
  });

  it('deletes the entry whose row was opened, named by its id', () => {
    render(
      <SessionTimeline
        session={session({
          older: drinkEntry(),
          newer: drinkEntry({ts: START + 60_000}),
        })}
      />,
    );

    fireEvent.press(screen.getByTestId('timeline-entry-options-older'));
    fireEvent.press(screen.getByTestId('menu-liveSessionScreen.deleteDrink'));

    // The OLDER entry, which "remove from latest" could never have reached.
    expect(DS.removeSessionEntry).toHaveBeenCalledWith('-Nsession1', 'older');
  });

  it('opens the edit modal for the entry whose row was opened', () => {
    render(
      <SessionTimeline
        session={session({
          older: drinkEntry(),
          newer: drinkEntry({ts: START + 60_000}),
        })}
      />,
    );

    fireEvent.press(screen.getByTestId('timeline-entry-options-newer'));
    fireEvent.press(screen.getByTestId('menu-liveSessionScreen.editDrink'));

    expect(screen.getByTestId('editing-newer')).toBeTruthy();
    expect(DS.removeSessionEntry).not.toHaveBeenCalled();
  });
});
