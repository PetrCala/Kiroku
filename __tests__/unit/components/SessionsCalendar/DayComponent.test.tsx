/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
import {render} from '@testing-library/react-native';
import React from 'react';
import DayComponent from '@components/SessionsCalendar/DayComponent';
import type {DateData} from 'react-native-calendars';
import type {DayState} from 'react-native-calendars/src/types';
import type {MarkingProps} from 'react-native-calendars/src/calendar/day/marking';

// PressableWithFeedback pulls in Reanimated → Worklets → native modules that
// don't initialize under Jest. A passthrough keeps the tile renderable.
jest.mock('@components/Pressable', () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const ReactM = jest.requireActual<typeof import('react')>('react');
  const RNm =
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    PressableWithFeedback: ({children}: {children: React.ReactNode}) =>
      ReactM.createElement(RNm.View, null, children),
  };
});

type Json = {
  type?: string;
  props?: Record<string, unknown>;
  children?: Array<Json | string> | null;
} | null;

/** A flattened RN style: nested arrays merged into one plain record. */
type Style = Record<string, unknown>;

function flattenStyle(style: unknown): Style {
  return ([] as unknown[])
    .concat(style ?? [])
    .filter(Boolean)
    .reduce<Style>((acc, s) => ({...acc, ...(s as Style)}), {});
}

/** Depth-first search for the first node whose flattened style matches. */
function findByStyle(
  node: Json | string | undefined,
  predicate: (style: Style) => boolean,
): Json | null {
  if (!node || typeof node === 'string') {
    return null;
  }
  if (predicate(flattenStyle(node.props?.style))) {
    return node;
  }
  for (const child of node.children ?? []) {
    const hit = findByStyle(child, predicate);
    if (hit) {
      return hit;
    }
  }
  return null;
}

const GREEN = '#008000';
const date: DateData = {
  dateString: '2026-09-10',
  day: 10,
  month: 9,
  year: 2026,
  timestamp: Date.UTC(2026, 8, 10),
};

const TILE_SIZE = 44;
const isTile = (style: Style) =>
  style.width === TILE_SIZE && style.height === TILE_SIZE;

type RenderDayOptions = {
  state?: DayState;
  units?: number;
  afStreak?: number;
  /** Defaults to the green swatch; pass `undefined` for an unmarked day. */
  marking?: MarkingProps;
};

function renderDay(options: RenderDayOptions): Json {
  const marking =
    'marking' in options ? options.marking : ({color: GREEN} as MarkingProps);
  return render(
    <DayComponent
      date={date}
      state={options.state}
      units={options.units}
      afStreak={options.afStreak}
      marking={marking}
    />,
  ).toJSON() as Json;
}

describe('SessionsCalendar DayComponent', () => {
  it('tints a lone alcohol-free day faintly, with no border and no unit count', () => {
    const tree = renderDay({afStreak: 1});
    const tile = findByStyle(tree, isTile);
    const style = flattenStyle(tile?.props?.style);
    // The swatch with an alpha byte, borderless, on the tile radius.
    expect(style.backgroundColor).toMatch(/^#008000[0-9a-f]{2}$/i);
    expect(style.borderWidth).toBeUndefined();
    expect(style.borderRadius).toBe(10);
    // No unit count on an alcohol-free day.
    expect(JSON.stringify(tree)).not.toContain('"children":["0"]');
  });

  it('fills the tile with the plain swatch once the run has saturated', () => {
    const tree = renderDay({afStreak: 7});
    const tile = findByStyle(tree, isTile);
    expect(flattenStyle(tile?.props?.style).backgroundColor).toBe(GREEN);
  });

  it('renders a session day as a solid swatch with its unit count', () => {
    const tree = renderDay({marking: {color: '#FFA500'}, units: 6.5});
    const tile = findByStyle(tree, isTile);
    expect(flattenStyle(tile?.props?.style).backgroundColor).toBe('#FFA500');
    expect(JSON.stringify(tree)).toContain('6.5');
  });

  it('draws the today ring flush inside the tile, and only for today', () => {
    const isRing = (style: Style) =>
      style.borderWidth === 2 && style.position === 'absolute';
    expect(findByStyle(renderDay({state: 'today'}), isRing)).not.toBeNull();
    expect(findByStyle(renderDay({}), isRing)).toBeNull();
  });

  it('swaps the ring off the accent when the tile is the accent yellow', () => {
    const isRing = (style: Style) =>
      style.borderWidth === 2 && style.position === 'absolute';
    const ringColor = (tree: Json) =>
      flattenStyle(findByStyle(tree, isRing)?.props?.style).borderColor;
    // Brand palette Light swatch: the accent itself. Ring falls back to the
    // dark on-swatch text so it still reads.
    const onAccentTile = ringColor(
      renderDay({state: 'today', marking: {color: '#F5C400'}, units: 0.5}),
    );
    // A tinted alcohol-free tile shows the ground through, so the ring keeps
    // the accent; the two must differ.
    const onTintedTile = ringColor(renderDay({state: 'today', afStreak: 1}));
    expect(onAccentTile).not.toBe(onTintedTile);
    expect(onTintedTile).toBe('#F5C400');
  });

  it('dims a future day to a transparent shell', () => {
    const tree = renderDay({state: 'disabled', marking: undefined});
    const tile = findByStyle(tree, isTile);
    const style = flattenStyle(tile?.props?.style);
    expect(style.backgroundColor).toBe('transparent');
    expect(style.opacity).toBe(0.35);
  });
});
