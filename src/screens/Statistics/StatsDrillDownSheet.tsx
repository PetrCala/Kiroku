import {useMemo} from 'react';
import {FlatList, View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import Button from '@components/Button';
import DrinkingSessionOverview from '@components/DrinkingSessionOverview';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import Modal from '@components/Modal';
import {PressableWithFeedback} from '@components/Pressable';
import Icon from '@components/Icon';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useStatsContext from '@hooks/useStatsContext';
import useDrinkEvents from '@hooks/useStatistics/useDrinkEvents';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {
  composeFilters,
  dateRange,
  drinkTypeSubset,
  forUsers,
} from '@libs/Statistics';
import type {DrinkEvent} from '@libs/Statistics';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DrinkingSession, DrinkingSessionId} from '@src/types/onyx';
import {
  bucketToFilter,
  bucketToSessionFilter,
} from './drilldown/bucketToFilter';
import bucketToTitle from './drilldown/bucketToTitle';
import {useStatsDrillDown} from './drilldown/DrillDownContext';

type SessionEntry = {
  sessionId: DrinkingSessionId;
  session: DrinkingSession;
  /** Newest event timestamp in the session — used to sort newest-first. */
  maxTs: number;
};

/**
 * Groups filtered events back into sessions, looks each up in the cached
 * session map, and returns them newest-first. Sessions that don't resolve
 * against the cache (e.g. evicted, foreign user) are dropped silently.
 */
function groupEventsIntoSessions(
  events: DrinkEvent[],
  sessionsByUser: Record<string, Record<string, DrinkingSession>> | undefined,
): SessionEntry[] {
  if (!sessionsByUser) {
    return [];
  }
  type Pending = {userId: string; eventCount: number; maxTs: number};
  const sessionPending = new Map<string, Pending>();
  for (const event of events) {
    const existing = sessionPending.get(event.sessionId);
    if (existing) {
      existing.eventCount += 1;
      if (event.ts > existing.maxTs) {
        existing.maxTs = event.ts;
      }
    } else {
      sessionPending.set(event.sessionId, {
        userId: event.userId,
        eventCount: 1,
        maxTs: event.ts,
      });
    }
  }
  const out: SessionEntry[] = [];
  for (const [sessionId, pending] of sessionPending) {
    const session = sessionsByUser[pending.userId]?.[sessionId];
    if (!session) {
      continue;
    }
    out.push({
      sessionId,
      session,
      maxTs: pending.maxTs,
    });
  }
  out.sort((a, b) => b.maxTs - a.maxTs);
  return out;
}

function StatsDrillDownSheet() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {activeBucket, closeDrillDown} = useStatsDrillDown();
  const {range, drinkTypeFilter, userIds} = useStatsContext();
  const {events} = useDrinkEvents(
    userIds.length > 0 ? [...userIds] : undefined,
  );
  // CACHED_DRINKING_SESSIONS is already subscribed by `useDrinkEvents` — this
  // is a second consumer of the same key, not a new fetch.
  const [sessionsByUser] = useOnyx(ONYXKEYS.CACHED_DRINKING_SESSIONS);

  const isVisible = activeBucket !== null;

  const sessions = useMemo<SessionEntry[]>(() => {
    if (!activeBucket) {
      return [];
    }
    const eventFilter = composeFilters(
      dateRange(range.start.getTime(), range.end.getTime()),
      drinkTypeFilter.size > 0 ? drinkTypeSubset(drinkTypeFilter) : undefined,
      userIds.length > 0 ? forUsers([...userIds]) : undefined,
      bucketToFilter(activeBucket),
    );
    const filteredEvents =
      eventFilter === undefined ? events : events.filter(eventFilter);
    const grouped = groupEventsIntoSessions(filteredEvents, sessionsByUser);
    const sessionFilter = bucketToSessionFilter(activeBucket);
    return grouped.filter(({sessionId, session}) => {
      const drinkCount = filteredEvents.reduce(
        (acc, e) => (e.sessionId === sessionId ? acc + e.count : acc),
        0,
      );
      const endTime = session.end_time;
      const durationMin =
        endTime !== undefined &&
        Number.isFinite(session.start_time) &&
        Number.isFinite(endTime)
          ? (endTime - session.start_time) / 60000
          : undefined;
      return sessionFilter({drinkCount, durationMin});
    });
  }, [activeBucket, events, range, drinkTypeFilter, userIds, sessionsByUser]);

  const title = useMemo(
    () => (activeBucket ? bucketToTitle(activeBucket, translate) : ''),
    [activeBucket, translate],
  );

  return (
    <Modal
      isVisible={isVisible}
      onClose={closeDrillDown}
      type={CONST.MODAL.MODAL_TYPE.BOTTOM_DOCKED}>
      <View style={[styles.pt3, styles.pb5, {minHeight: 240, maxHeight: 560}]}>
        <View
          style={[
            styles.flexRow,
            styles.alignItemsCenter,
            styles.justifyContentBetween,
            styles.ph4,
            styles.mb2,
          ]}>
          <Text style={[styles.textHeadline, styles.flex1, styles.mr2]}>
            {title}
          </Text>
          <PressableWithFeedback
            accessibilityLabel={translate('statistics.drilldown.close')}
            accessibilityRole="button"
            onPress={closeDrillDown}
            style={[styles.p2]}>
            <Icon src={KirokuIcons.Close} fill={theme.icon} />
          </PressableWithFeedback>
        </View>
        {sessions.length === 0 ? (
          <View style={[styles.flex1, styles.justifyContentCenter, styles.p5]}>
            <Text style={[styles.textSupporting, styles.textAlignCenter]}>
              {translate('statistics.drilldown.empty')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={item => String(item.sessionId)}
            renderItem={({item}) => (
              <DrinkingSessionOverview
                sessionId={item.sessionId}
                session={item.session}
                isEditModeOn={false}
              />
            )}
          />
        )}
        <View style={[styles.ph4, styles.mt2]}>
          <Button
            large
            text={translate('common.close')}
            onPress={closeDrillDown}
          />
        </View>
      </View>
    </Modal>
  );
}

StatsDrillDownSheet.displayName = 'StatsDrillDownSheet';

export default StatsDrillDownSheet;
