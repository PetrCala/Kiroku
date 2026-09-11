import type {AppStateStatus, NativeEventSubscription} from 'react-native';
import {AppState} from 'react-native';
import CONST from '@src/CONST';

/**
 * A shared once-a-second clock for running timers, shaped as a
 * `useSyncExternalStore` source (see `useCurrentTime`).
 *
 * Every subscriber shares one timer, so several timers on screen tick together
 * and only the components that read the clock re-render. The timer only runs
 * while something is subscribed and the app is in the foreground: timers
 * don't fire reliably in the background anyway, and coming back to the
 * foreground refreshes the time right away instead of waiting for the next
 * tick. Callers derive what they show from the current time (e.g. `now -
 * start`), so a paused clock never drifts.
 */

const TICK_MS = 1000;

let now = Date.now();
let tickTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: NativeEventSubscription | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  now = Date.now();
  listeners.forEach(listener => listener());
}

function stopTicking(): void {
  if (!tickTimer) {
    return;
  }
  clearTimeout(tickTimer);
  tickTimer = null;
}

/** Tick on the wall-clock second, so every subscriber flips at the same time. */
function scheduleTick(): void {
  stopTicking();
  tickTimer = setTimeout(
    () => {
      tickTimer = null;
      emit();
      scheduleTick();
    },
    TICK_MS - (Date.now() % TICK_MS),
  );
}

function handleAppStateChange(state: AppStateStatus): void {
  if (state === CONST.APP_STATE.BACKGROUND) {
    stopTicking();
    return;
  }
  if (state === CONST.APP_STATE.ACTIVE) {
    emit();
    scheduleTick();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    now = Date.now();
    appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    if (AppState.currentState !== CONST.APP_STATE.BACKGROUND) {
      scheduleTick();
    }
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) {
      return;
    }
    stopTicking();
    appStateSubscription?.remove();
    appStateSubscription = null;
  };
}

/**
 * The current time, cached between ticks so repeated reads within one render
 * agree. While nothing is subscribed the cache would go stale, so the first
 * read after an idle stretch refreshes it.
 */
function getNow(): number {
  if (listeners.size === 0 && Date.now() - now >= TICK_MS) {
    now = Date.now();
  }
  return now;
}

export default {subscribe, getNow};
