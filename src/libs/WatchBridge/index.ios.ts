/**
 * Phone-side JS wiring of the Apple Watch credential bridge (Phase 3 of
 * docs/apple-watch-mvp.md). Whenever a fresh Firebase ID token exists, it is
 * handed (with the current ongoing-session snapshot) to the native
 * `WatchBridge` module, which pushes it to the watch over WatchConnectivity.
 *
 * Known limitation: iOS does not reliably run the RN JS bridge in the
 * background, so pushes only happen while the app is alive/foreground. The
 * watch caches the last token until its expiry and then asks the user to open
 * the app on the phone.
 */
import {NativeModules} from 'react-native';
import throttle from 'lodash/throttle';
import Onyx from 'react-native-onyx';
import {getKirokuApiEnv} from '@libs/ApiUtils';
import AppStateMonitor from '@libs/AppStateMonitor';
import {getDrinkCount} from '@libs/DrinkEntryUtils';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import Log from '@libs/Log';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DrinkingSession} from '@src/types/onyx';
import type {WatchBridgeModule, WatchCredentialPayload} from './types';

// Under jest the react-native mock has no NativeModules at all, hence the
// optional chain; on a device the module is compiled into the app target.
const WatchBridge: WatchBridgeModule | undefined = NativeModules?.WatchBridge;

const SIGNED_OUT_SENTINEL = 'signed-out';

let ongoingSessionJson: string | undefined;
let lastPayloadKey: string | undefined;
let isInitialized = false;

/**
 * Serialize the ongoing session into the exact shape the watch's Codable model
 * (ios/KirokuWatchCore .../DrinkingSession.swift) decodes: every non-optional
 * field present, drink entries collapsed to plain counts, JS-only fields
 * (drinksTimeParts) dropped. Returns undefined when there is nothing live to
 * mirror, so the payload key is omitted (never null: NSNull is not plist-safe).
 */
function serializeOngoingSession(
  session: DrinkingSession | undefined,
): string | undefined {
  if (!session?.ongoing || !session.id) {
    return undefined;
  }
  const drinks: Record<string, Record<string, number>> = {};
  Object.entries(session.drinks ?? {}).forEach(([timestamp, bucket]) => {
    const normalized: Record<string, number> = {};
    Object.entries(bucket ?? {}).forEach(([drinkKey, entry]) => {
      const count = getDrinkCount(entry);
      if (count > 0) {
        normalized[drinkKey] = count;
      }
    });
    if (Object.keys(normalized).length > 0) {
      drinks[timestamp] = normalized;
    }
  });
  const hasDrinks = Object.keys(drinks).length > 0;
  return JSON.stringify({
    id: session.id,
    start_time: session.start_time,
    end_time: session.end_time ?? session.start_time,
    blackout: !!session.blackout,
    note: session.note ?? '',
    timezone: session.timezone ?? CONST.DEFAULT_TIME_ZONE.selected,
    type: session.type ?? CONST.SESSION.TYPES.LIVE,
    ongoing: true,
    ...(hasDrinks ? {drinks} : {}),
  });
}

/**
 * Gather the current credential (+ ongoing-session snapshot) and hand it to
 * the native module. Deduped here on the composed payload; the native side
 * dedupes again as a backstop before touching WCSession.
 */
async function pushCredentialToWatch(): Promise<void> {
  if (!WatchBridge) {
    return;
  }
  const user = getFirebaseAuth().currentUser;
  if (!user) {
    if (lastPayloadKey !== SIGNED_OUT_SENTINEL) {
      lastPayloadKey = SIGNED_OUT_SENTINEL;
      WatchBridge.clearCredential();
    }
    return;
  }
  try {
    // Returns the cached token unless it is about to expire; only then does it
    // hit the network, so this is cheap to call on every trigger.
    const result = await user.getIdTokenResult();
    const payload: WatchCredentialPayload = {
      idToken: result.token,
      uid: user.uid,
      expiresAt: new Date(result.expirationTime).getTime(),
      apiEnv: getKirokuApiEnv(),
      ...(ongoingSessionJson ? {ongoingSession: ongoingSessionJson} : {}),
    };
    const payloadKey = [
      payload.uid,
      payload.idToken,
      payload.expiresAt,
      payload.apiEnv,
      ongoingSessionJson ?? '',
    ].join('|');
    if (payloadKey === lastPayloadKey) {
      return;
    }
    lastPayloadKey = payloadKey;
    WatchBridge.updateCredential(payload);
  } catch (error) {
    Log.hmmm('[WatchBridge] Failed to push the credential to the watch', {
      error,
    });
  }
}

// Leading edge makes the first trigger of a burst (e.g. login) push
// immediately; the trailing edge guarantees the final state of a tap burst
// lands. 2s keeps the watch close behind while capping WCSession traffic.
const throttledPush = throttle(pushCredentialToWatch, 2000);

function init(): void {
  if (isInitialized || !WatchBridge) {
    return;
  }
  isInitialized = true;

  // Fires on login, sign-out, and every token refresh, including the forced
  // `getIdToken(true)` the 407 path runs in Middleware/Reauthentication.ts,
  // so one listener covers "after login" and "after the 407 refresh".
  getFirebaseAuth().onIdTokenChanged(() => {
    throttledPush();
  });

  // App foreground: the recovery path after long background gaps, during
  // which no refresh could run (see the limitation note above).
  AppStateMonitor.addBecameActiveListener(() => {
    throttledPush();
  });

  // Ongoing-session changes; sign-out's Onyx.clear and the finalize/discard
  // `Onyx.set(null)` land here too and clear the mirrored snapshot.
  // This is module-scope bridge wiring with no React context to hang a
  // useOnyx on, the same pattern as HttpUtils' NETWORK connection.
  // eslint-disable-next-line rulesdir/no-onyx-connect
  Onyx.connect({
    key: ONYXKEYS.ONGOING_SESSION_DATA,
    callback: value => {
      ongoingSessionJson = serializeOngoingSession(value ?? undefined);
      throttledPush();
    },
  });
}

export default {init};
export {pushCredentialToWatch, serializeOngoingSession};
