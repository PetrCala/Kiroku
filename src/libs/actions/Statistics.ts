import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import type {StatisticsFilters} from '@src/types/onyx';

/**
 * Merge a patch into the persisted Statistics filter state. The provider
 * holds the React-state source of truth for the current render; this write
 * is best-effort persistence so the user's last range / drink-type
 * selection rehydrates on the next app launch.
 */
function setFilters(patch: Partial<StatisticsFilters>): void {
  Onyx.merge(ONYXKEYS.STATISTICS_FILTERS, patch);
}

export default {setFilters};
