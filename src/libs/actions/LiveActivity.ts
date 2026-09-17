import type {OnyxEntry} from 'react-native-onyx';
import type {LocaleContextProps} from '@components/LocaleContextProvider';
import * as API from '@libs/API';
import {WRITE_COMMANDS} from '@libs/API/types';
import {getAutoCloseAt} from '@libs/AutoClose';
import {calculateTotalUnits} from '@libs/DrinkingSessionUtils';
import LiveActivity from '@libs/LiveActivity';
import type {
  LiveActivityPushToken,
  LiveSessionActivityPayload,
} from '@libs/LiveActivity/types';
import {getSessionEntries, sumEntryCounts} from '@libs/SessionEntries';
import Log from '@libs/Log';
import {getDefaultSessionName} from '@libs/SessionName';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type {Config, DrinkingSession, Preferences} from '@src/types/onyx';
import type {DrinksToUnits} from '@src/types/onyx/Preferences';
import * as Device from './Device';

/**
 * Keeps the lock-screen view of a live session (Sessions v2 RFC §8) in step
 * with the session itself: the iOS Live Activity and the Android ongoing
 * notification, from one place.
 *
 * This module never writes a session and never watches Onyx. It is handed the
 * current state by `useLiveActivity` and works out which of start / update /
 * end that means. Keeping it here, rather than in the session write path,
 * is deliberate: W2 is rewriting those writes, and a surface driven by
 * observed state cannot miss a write it does not know about.
 */

/** What the last sync sent, so the next one can tell start from update. */
let lastPayload: LiveSessionActivityPayload | undefined;

/**
 * Whether this process has synced at all. The first sync always says
 * something, even with no session: iOS keeps activities alive across launches,
 * so an app that starts with nothing live may still have an orphan on the lock
 * screen from a session that ended while it was dead.
 */
let hasSynced = false;

/**
 * Whether this device has told the server about a Live Activity push token.
 * Only iOS ever does; Android's ongoing notification is local and has nothing
 * to address, so nothing is registered and nothing has to be cleared.
 */
let hasRegisteredPushToken = false;

type LiveActivityState = {
  /** The ongoing session, or nothing when none is live */
  session: OnyxEntry<DrinkingSession>;

  /** The user's per-drink unit factors */
  drinksToUnits: DrinksToUnits | undefined;

  /** The current locale's translate, for the text the native side shows */
  translate: LocaleContextProps['translate'];

  /** The user's auto-close preference, for the Android notification timeout */
  autoClosePreference: Preferences['auto_close_sessions_after_hours'];

  /** The global auto-close default, same purpose */
  autoCloseDefaultHours: Config['auto_close_default_hours'];
};

/**
 * The tap target. iOS registers the `kiroku` scheme in `Info.plist` (it was
 * added with the friends hub) and Android registers it in the manifest, so one
 * deep link works on both. A universal link would need `/drinking-session/*`
 * added to the AASA, which would make every live-session URL resolvable on the
 * web for no gain.
 */
function liveSessionDeepLink(sessionId: string): string {
  return `${CONST.DEEPLINK_BASE_URL}${ROUTES.DRINKING_SESSION_LIVE.getRoute(sessionId)}`;
}

/** The payload for a live session, or nothing when there is none to show. */
function buildPayload({
  session,
  drinksToUnits,
  translate,
  autoClosePreference,
  autoCloseDefaultHours,
}: LiveActivityState): LiveSessionActivityPayload | undefined {
  if (!session?.ongoing || !session.id || !session.start_time) {
    return undefined;
  }
  const units = calculateTotalUnits(session, drinksToUnits, true);
  const autoCloseAt = getAutoCloseAt(
    session,
    autoClosePreference,
    autoCloseDefaultHours,
  );
  return {
    sessionId: session.id,
    startedAt: session.start_time,
    deepLink: liveSessionDeepLink(session.id),
    name:
      session.name ??
      getDefaultSessionName(session.start_time, session.timezone),
    unitsText: translate('homeScreen.liveSessionCard.units', {
      unitCount: units,
    }),
    drinkCount: sumEntryCounts(getSessionEntries(session)),
    drinksLabel: translate('common.drinks'),
    channelName: translate('homeScreen.liveSessionCard.label'),
    ...(autoCloseAt !== undefined ? {autoCloseAt} : {}),
  };
}

/** Whether anything the lock screen shows actually changed. */
function hasChanged(
  next: LiveSessionActivityPayload,
  previous: LiveSessionActivityPayload,
): boolean {
  return (
    next.name !== previous.name ||
    next.unitsText !== previous.unitsText ||
    next.drinkCount !== previous.drinkCount ||
    next.drinksLabel !== previous.drinksLabel ||
    next.channelName !== previous.channelName ||
    next.autoCloseAt !== previous.autoCloseAt ||
    next.startedAt !== previous.startedAt
  );
}

/**
 * Reconcile the lock screen with the current session state. Safe to call on
 * every change: a sync that changes nothing sends nothing.
 */
function sync(state: LiveActivityState): void {
  const payload = buildPayload(state);
  const previous = lastPayload;
  const isFirstSync = !hasSynced;
  hasSynced = true;
  lastPayload = payload;

  if (!payload) {
    if (!previous && !isFirstSync) {
      return;
    }
    // With no previous payload there is nothing to summarize, but the call
    // still goes out: natively it clears any activity left over from an
    // earlier launch.
    LiveActivity.end({
      ...(previous ?? emptyPayload()),
      endedAt: Date.now(),
    });
    unregisterPushToken();
    return;
  }

  if (!previous || previous.sessionId !== payload.sessionId) {
    LiveActivity.start(payload);
    return;
  }
  if (hasChanged(payload, previous)) {
    LiveActivity.update(payload);
  }
}

/**
 * A payload that identifies no session, for the "clear whatever is there"
 * call. The native side ends every activity it owns regardless of the ids.
 */
function emptyPayload(): LiveSessionActivityPayload {
  return {
    sessionId: '',
    startedAt: Date.now(),
    deepLink: '',
    name: '',
    unitsText: '',
    drinkCount: 0,
    drinksLabel: '',
    channelName: '',
  };
}

/**
 * Tell kiroku-api which activity this device is showing, so the server can
 * push an update to it. Nothing sends those updates yet: a solo session
 * updates its own activity from the app, and shared sessions are W6c. This
 * exists so W6c finds the registry already populated.
 *
 * Queued like any write, so it survives being offline. The server stores it
 * under the device's entry in the registry from Kiroku#1640.
 */
function registerPushToken({sessionId, token}: LiveActivityPushToken): void {
  Device.getDeviceID()
    .then(deviceID => {
      if (!deviceID) {
        return;
      }
      hasRegisteredPushToken = true;
      API.write(WRITE_COMMANDS.REGISTER_LIVE_ACTIVITY, {
        deviceID,
        sessionId,
        token,
      });
    })
    .catch(error => {
      Log.hmmm('[LiveActivity] Could not register the push token', {error});
    });
}

/** The activity is gone, so the token that addressed it is dead. */
function unregisterPushToken(): void {
  if (!hasRegisteredPushToken) {
    return;
  }
  hasRegisteredPushToken = false;
  Device.getDeviceID()
    .then(deviceID => {
      if (!deviceID) {
        return;
      }
      API.write(WRITE_COMMANDS.UNREGISTER_LIVE_ACTIVITY, {deviceID});
    })
    .catch(error => {
      Log.hmmm('[LiveActivity] Could not unregister the push token', {error});
    });
}

/**
 * Start following the running activity's push token. iOS mints one per
 * activity and may rotate it while the activity runs, so this listens for as
 * long as the user is signed in. A no-op on Android and web, where the native
 * surface has no token to give. Returns an unsubscribe.
 */
function watchPushToken(): () => void {
  const unsubscribe = LiveActivity.subscribeToPushToken?.(registerPushToken);
  return () => unsubscribe?.();
}

/** Drop the remembered state, without touching the lock screen. For tests. */
function reset(): void {
  lastPayload = undefined;
  hasSynced = false;
  hasRegisteredPushToken = false;
}

/**
 * Clear the lock screen and forget everything. Sign-out runs this rather than
 * relying on Onyx emptying first, so a signed-out phone never keeps showing a
 * session.
 */
function stop(): void {
  const previous = lastPayload;
  const hadPushToken = hasRegisteredPushToken;
  reset();
  LiveActivity.end({...(previous ?? emptyPayload()), endedAt: Date.now()});
  // Sign-out drops the whole device from the registry anyway, but the server
  // call that does it needs a Firebase session this one may already have lost.
  // Asking twice is a no-op; asking once too few leaves a dead token behind.
  hasRegisteredPushToken = hadPushToken;
  unregisterPushToken();
}

export {buildPayload, liveSessionDeepLink, reset, stop, sync, watchPushToken};
export type {LiveActivityState};
