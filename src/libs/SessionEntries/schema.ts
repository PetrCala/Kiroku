import CONST from '@src/CONST';
import type {
  DrinkingSession,
  DrinkingSessionV2,
  LegacyDrinkingSession,
} from '@src/types/onyx';

/**
 * Whether a session is a Sessions v2 session (RFC §4.2): `schema_version` is
 * `2` and its drinks live in `entries`. `entries` may still be absent on a v2
 * session with nothing logged yet, because RTDB drops empty maps.
 */
function isSchemaV2Session(
  session: DrinkingSession | null | undefined,
): session is DrinkingSessionV2 {
  return session?.schema_version === CONST.SESSION.SCHEMA_VERSION;
}

/**
 * Whether a session is a legacy session: no `schema_version`, drinks (if any)
 * in `drinks[timestamp][drinkKey]` buckets. Every session that is not v2 is
 * legacy, including one with no drinks at all.
 */
function isLegacySession(
  session: DrinkingSession | null | undefined,
): session is LegacyDrinkingSession {
  return !!session && !isSchemaV2Session(session);
}

export {isLegacySession, isSchemaV2Session};
