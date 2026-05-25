import Onyx from 'react-native-onyx';
import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {
  DrinkingSession,
  DrinksList,
  UserDrinkingSessionsList,
} from '@src/types/onyx';
import Log from '@libs/Log';

/**
 * Phase-1 Statistics v2 storage migration. The Drinks shape widened from
 * `Partial<Record<DrinkKey, number>>` to a `number | {count, volume_ml?, abv?}`
 * union (see #577). This walks every Onyx target that carries `.drinks` and
 * promotes legacy numeric entries to the object form `{count: N}`.
 *
 * Idempotent: the predicate `typeof entry === 'number'` is the marker — after
 * one pass every entry is an object, so re-runs write nothing. The numeric
 * arm of the union is intentionally still legal, so a partially-completed
 * migration cannot corrupt reads: narrowing via `DrinkEntryUtils.getDrinkCount`
 * handles both shapes.
 */

type ConvertedDrinksList = {drinks: DrinksList; changed: boolean};

function convertDrinksList(
  drinks: DrinksList | undefined,
): ConvertedDrinksList | undefined {
  if (!drinks) {
    return undefined;
  }
  let changed = false;
  const next: DrinksList = {};
  for (const [timestamp, drinksAtTimestamp] of Object.entries(drinks)) {
    const nextDrinks: DrinksList[number] = {};
    for (const [key, entry] of Object.entries(drinksAtTimestamp)) {
      if (typeof entry === 'number') {
        nextDrinks[key as keyof typeof nextDrinks] = {count: entry};
        changed = true;
      } else {
        nextDrinks[key as keyof typeof nextDrinks] = entry;
      }
    }
    next[Number(timestamp)] = nextDrinks;
  }
  return {drinks: next, changed};
}

function convertSession(
  session: OnyxEntry<DrinkingSession>,
): {session: DrinkingSession; changed: boolean} | undefined {
  if (!session) {
    return undefined;
  }
  const converted = convertDrinksList(session.drinks);
  if (!converted || !converted.changed) {
    return undefined;
  }
  return {
    session: {...session, drinks: converted.drinks},
    changed: true,
  };
}

// One-shot Onyx reads are the right tool inside a pre-auth migration step —
// there is no React tree yet, so the useOnyx() pathway does not apply.
function readCollectionOnce<T>(
  key: typeof ONYXKEYS.COLLECTION.DRINKING_SESSION,
): Promise<OnyxCollection<T> | undefined> {
  return new Promise(resolve => {
    // eslint-disable-next-line rulesdir/no-onyx-connect
    const connection = Onyx.connect({
      key,
      waitForCollectionCallback: true,
      callback: value => {
        Onyx.disconnect(connection);
        resolve(value as OnyxCollection<T> | undefined);
      },
    });
  });
}

function readKeyOnce<T>(
  key:
    | typeof ONYXKEYS.ONGOING_SESSION_DATA
    | typeof ONYXKEYS.EDIT_SESSION_DATA
    | typeof ONYXKEYS.CACHED_DRINKING_SESSIONS,
): Promise<T | undefined> {
  return new Promise(resolve => {
    // eslint-disable-next-line rulesdir/no-onyx-connect
    const connection = Onyx.connect({
      key,
      callback: value => {
        Onyx.disconnect(connection);
        resolve(value as T | undefined);
      },
    });
  });
}

async function migrateCollection(): Promise<number> {
  const collection = await readCollectionOnce<DrinkingSession>(
    ONYXKEYS.COLLECTION.DRINKING_SESSION,
  );
  if (!collection) {
    return 0;
  }
  type CollectionUpdates = Parameters<
    typeof Onyx.mergeCollection<typeof ONYXKEYS.COLLECTION.DRINKING_SESSION>
  >[1];
  const updates = {} as CollectionUpdates;
  let touched = 0;
  for (const [key, session] of Object.entries(collection)) {
    const converted = convertSession(session ?? undefined);
    if (converted) {
      (updates as Record<string, DrinkingSession>)[key] = converted.session;
      touched += 1;
    }
  }
  if (touched > 0) {
    // eslint-disable-next-line rulesdir/prefer-actions-set-data
    await Onyx.mergeCollection(ONYXKEYS.COLLECTION.DRINKING_SESSION, updates);
  }
  return touched;
}

async function migrateSingleSession(
  key: typeof ONYXKEYS.ONGOING_SESSION_DATA | typeof ONYXKEYS.EDIT_SESSION_DATA,
): Promise<number> {
  const session = await readKeyOnce<DrinkingSession>(key);
  const converted = convertSession(session ?? undefined);
  if (!converted) {
    return 0;
  }
  // eslint-disable-next-line rulesdir/prefer-actions-set-data
  await Onyx.merge(key, converted.session);
  return 1;
}

async function migrateCachedDrinkingSessions(): Promise<number> {
  const cached = await readKeyOnce<UserDrinkingSessionsList>(
    ONYXKEYS.CACHED_DRINKING_SESSIONS,
  );
  if (!cached) {
    return 0;
  }
  const next: UserDrinkingSessionsList = {};
  let touched = 0;
  for (const [userID, sessionList] of Object.entries(cached)) {
    const nextSessionList: typeof sessionList = {};
    let userChanged = false;
    for (const [sessionId, session] of Object.entries(sessionList ?? {})) {
      const converted = convertSession(session);
      if (converted) {
        nextSessionList[sessionId] = converted.session;
        userChanged = true;
        touched += 1;
      } else {
        nextSessionList[sessionId] = session;
      }
    }
    next[userID] = userChanged ? nextSessionList : sessionList;
  }
  if (touched > 0) {
    // eslint-disable-next-line rulesdir/prefer-actions-set-data
    await Onyx.set(ONYXKEYS.CACHED_DRINKING_SESSIONS, next);
  }
  return touched;
}

export default async function HydrateLegacyDrinkEntries(): Promise<void> {
  Log.info('[Migrate Onyx] HydrateLegacyDrinkEntries: start');
  const counts = await Promise.all([
    migrateCollection(),
    migrateSingleSession(ONYXKEYS.ONGOING_SESSION_DATA),
    migrateSingleSession(ONYXKEYS.EDIT_SESSION_DATA),
    migrateCachedDrinkingSessions(),
  ]);
  const total = counts.reduce((sum, n) => sum + n, 0);
  Log.info(
    `[Migrate Onyx] HydrateLegacyDrinkEntries: hydrated ${total} session(s)`,
  );
}

export {convertDrinksList, convertSession};
