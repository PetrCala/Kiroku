import type {Preferences} from '@src/types/onyx';

/**
 * Partial preferences write sent to `POST /v1/preferences`. Field names map 1:1
 * to the server's recognized preference keys (it reads each from the JSON body),
 * so callers pass the same `Partial<Preferences>` shape the legacy Firebase
 * `updatePreferences` accepted.
 */
type UpdatePreferencesParams = Partial<Preferences>;

export default UpdatePreferencesParams;
