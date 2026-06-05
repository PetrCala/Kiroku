import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DataVisibility} from '@src/types/onyx';

/**
 * The signed-in user's data-visibility settings, sourced from Onyx
 * `DATA_VISIBILITY` — hydrated by `app/open` and echoed by the privacy write
 * endpoints (kiroku-api), not a Firebase listener.
 *
 * Returns `undefined` only while the key is still resolving, matching the old
 * `useDatabaseData().dataVisibility` semantics (absent ⇒ fully visible, the
 * grandfathered default).
 */
function useCurrentUserDataVisibility(): DataVisibility | undefined {
  const [dataVisibility] = useOnyx(ONYXKEYS.DATA_VISIBILITY);
  return dataVisibility;
}

export default useCurrentUserDataVisibility;
