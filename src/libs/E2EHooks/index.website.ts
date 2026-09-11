import Onyx from 'react-native-onyx';
import type {OnyxKey} from 'react-native-onyx';
import {getKirokuApiRoot} from '@libs/ApiUtils';
import DateUtils from '@libs/DateUtils';
import * as FeatureFlags from '@libs/FeatureFlags';
import type {FeatureFlag} from '@libs/FeatureFlags';
import {getFirebaseAuth} from '@libs/Firebase/FirebaseApp';
import * as NetworkStore from '@libs/Network/NetworkStore';
import * as DS from '@userActions/DrinkingSession';
import * as Network from '@userActions/Network';
import * as PersistedRequests from '@userActions/PersistedRequests';
import {sendSessionOp} from '@userActions/SessionOps';
import ONYXKEYS from '@src/ONYXKEYS';
import type OnyxRequest from '@src/types/onyx/Request';

/**
 * A queued request as a spec sees it (functions can't cross into Playwright).
 * The request in flight is listed first, as `isOngoing`: it has left the
 * persisted queue but hasn't been answered yet.
 */
type QueuedRequestSnapshot = {
  command: string;
  data?: Record<string, unknown>;
  isRollbacked?: boolean;
  isOngoing?: boolean;
};

/**
 * What the web e2e suite can reach from the page (`window.kirokuE2E`): the
 * entry points to code no UI drives yet (session ops ship switched off),
 * read access to the state the specs assert on, and a way to delete a
 * session a failed spec left behind.
 */
type E2EHooks = {
  setFeatureFlag: (flag: FeatureFlag, value: boolean | undefined) => void;
  sendSessionOp: typeof sendSessionOp;
  getServerTime: () => number;
  getApiRoot: () => string;
  setShouldForceOffline: (shouldForceOffline: boolean) => void;
  isOffline: () => boolean;
  setTimeSkew: (skew: number) => void;
  getQueuedRequests: () => QueuedRequestSnapshot[];
  getOnyxValue: (key: OnyxKey) => Promise<unknown>;
  deleteSession: (sessionId: string) => Promise<void>;
};

function toSnapshot(request: OnyxRequest): QueuedRequestSnapshot {
  return {
    command: request.command,
    data: request.data,
    isRollbacked: request.isRollbacked,
  };
}

function getQueuedRequests(): QueuedRequestSnapshot[] {
  const ongoing = PersistedRequests.getOngoingRequest();
  return [
    ...(ongoing ? [{...toSnapshot(ongoing), isOngoing: true}] : []),
    ...PersistedRequests.getAll().map(toSnapshot),
  ];
}

function getOnyxValue(key: OnyxKey): Promise<unknown> {
  return new Promise(resolve => {
    let isResolved = false;
    const connection = Onyx.connectWithoutView({
      key,
      callback: value => {
        if (isResolved) {
          return;
        }
        isResolved = true;
        Onyx.disconnect(connection);
        resolve(value);
      },
    });
  });
}

/**
 * Delete a session a failed spec left behind, so it doesn't leak onto the
 * shared test account. It goes through the app's own delete as a live
 * session, which also cancels a pending live save that could re-create it
 * and clears the user's live status.
 */
function deleteSession(sessionId: string): Promise<void> {
  const userID = getFirebaseAuth().currentUser?.uid;
  if (!userID) {
    return Promise.reject(new Error('No signed-in user'));
  }
  return DS.removeDrinkingSessionData(
    userID,
    sessionId,
    ONYXKEYS.ONGOING_SESSION_DATA,
    true,
  );
}

/**
 * Expose the e2e hooks on dev builds (`npm run web` and the PR preview
 * channel, both built from `.env.development`). Production, staging and adhoc
 * bundles are built with `__DEV__` false, so they never install them.
 */
export default function installE2EHooks() {
  if (!__DEV__) {
    return;
  }
  const hooks: E2EHooks = {
    setFeatureFlag: FeatureFlags.setDevOverride,
    sendSessionOp,
    getServerTime: DateUtils.getServerTime,
    getApiRoot: getKirokuApiRoot,
    setShouldForceOffline: Network.setShouldForceOffline,
    isOffline: NetworkStore.isOffline,
    setTimeSkew: Network.setTimeSkew,
    getQueuedRequests,
    getOnyxValue,
    deleteSession,
  };
  (window as Window & {kirokuE2E?: E2EHooks}).kirokuE2E = hooks;
}
