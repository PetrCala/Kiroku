/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
import {render} from '@testing-library/react-native';
import React from 'react';
import DayComponent from '@components/SessionsCalendar/DayComponent';
import type {DateData} from 'react-native-calendars';
import type {DayState} from 'react-native-calendars/src/types';
import type {SessionsCalendarMarking} from '@components/SessionsCalendar/DayComponent/types';
import {mixHex} from '@libs/SessionColorPalettes';

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

// Tokens of the theme the test renderer resolves to (dark), which the tile
// derives its colors from.
const APP_BG = '#0D1117';
const ICON = '#9198A1';
// The palette green at 35% over the app background.
const AF_TINT = mixHex(APP_BG, GREEN, 0.35);

type RenderDayOptions = {
  state?: DayState;
  units?: number;
  /** Defaults to an alcohol-free day; pass `undefined` for an unmarked day. */
  marking?: SessionsCalendarMarking;
};

const AF_MARKING: SessionsCalendarMarking = {color: GREEN, isAlcoholFree: true};

function renderDay(options: RenderDayOptions): Json {
  const marking = 'marking' in options ? options.marking : AF_MARKING;
  return render(
    <DayComponent
      date={date}
      state={options.state}
      units={options.units}
      marking={marking}
    />,
  ).toJSON() as Json;
}

const isRing = (style: Style) =>
  style.borderWidth === 1.5 && style.position === 'absolute';

describe('SessionsCalendar DayComponent', () => {
  it('draws an alcohol-free day as a flat 35% tint, not the full green', () => {
    const tree = renderDay({});
    const tile = findByStyle(tree, isTile);
    const style = flattenStyle(tile?.props?.style);
    expect(style.backgroundColor).toBe(AF_TINT);
    expect(AF_TINT).not.toBe(GREEN);
    expect(style.borderRadius).toBe(10);
    // The day number stays in the supporting text color.
    expect(JSON.stringify(tree)).not.toContain('"children":["0"]');
  });

  it('renders a session day as a solid swatch with its unit count', () => {
    const tree = renderDay({marking: {color: '#FFA500'}, units: 6.5});
    const tile = findByStyle(tree, isTile);
    expect(flattenStyle(tile?.props?.style).backgroundColor).toBe('#FFA500');
    expect(JSON.stringify(tree)).toContain('6.5');
  });

  it('gives every filled tile a 1px edge pulled toward the text color', () => {
    const edgeOf = (marking: SessionsCalendarMarking | undefined) =>
      flattenStyle(findByStyle(renderDay({marking}), isTile)?.props?.style);
    // Pale swatch on the light ground: the edge is a visibly darker tint.
    const pale = edgeOf({color: '#FFED8F'});
    expect(pale.borderWidth).toBe(1);
    expect(pale.borderColor).not.toBe('#FFED8F');
    expect(pale.borderColor).toMatch(/^#[0-9a-f]{6}$/i);
    // Same edge rule on the tinted alcohol-free tile.
    const af = edgeOf(AF_MARKING);
    expect(af.borderColor).not.toBe(AF_TINT);
    // Unmarked cells keep the 1px border for geometry, but transparent.
    const empty = edgeOf(undefined);
    expect(empty.borderWidth).toBe(1);
    expect(empty.borderColor).toBe('transparent');
  });

  it('draws a hairline ring in the icon gray, and only for today', () => {
    const ring = findByStyle(renderDay({state: 'today'}), isRing);
    expect(ring).not.toBeNull();
    expect(flattenStyle(ring?.props?.style).borderColor).toBe(ICON);
    expect(findByStyle(renderDay({}), isRing)).toBeNull();
    // Same ring on a session tile: it never depends on the fill.
    const onSession = findByStyle(
      renderDay({state: 'today', marking: {color: '#F5C400'}, units: 0.5}),
      isRing,
    );
    expect(flattenStyle(onSession?.props?.style).borderColor).toBe(ICON);
  });

  it('dims a future day to a transparent shell', () => {
    const tree = renderDay({state: 'disabled', marking: undefined});
    const tile = findByStyle(tree, isTile);
    const style = flattenStyle(tile?.props?.style);
    expect(style.backgroundColor).toBe('transparent');
    expect(style.opacity).toBe(0.35);
  });
});
