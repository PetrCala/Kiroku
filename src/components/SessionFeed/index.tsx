import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import type {ReactElement} from 'react';
import type {StyleProp, ViewStyle} from 'react-native';
import {ActivityIndicator, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import type {ListRenderItemInfo} from '@shopify/flash-list';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useSessionFeed from '@hooks/useSessionFeed';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import type DrinkingSessionKeyValue from '@src/types/utils/databaseUtils';
import FriendsDrinkingNow from './FriendsDrinkingNow';
import SessionFeedCard from './SessionFeedCard';

/**
 * Fetch the next page once the user is within this fraction of the visible
 * length from the end. Generous, so a fling rarely reaches a blank end.
 */
const END_REACHED_THRESHOLD = 0.8;

type SessionFeedProps = {
  /** Whose feed: the signed-in user on Home. */
  userID: UserID;

  /** What sits above the feed (the live card, the overview, the calendar). */
  header: ReactElement;

  /** Whether the header's data has resolved, so the feed may show its own states. */
  isReady: boolean;

  /** Padding of the whole scrollable content, as the plain ScrollView had it. */
  contentContainerStyle: StyleProp<ViewStyle>;
};

/**
 * Home's scroll container while the feed is on (RFC §10, decision 15): one
 * virtualised list whose header is everything Home showed before (the live
 * card, then the calendar) and whose rows are the user's sessions, newest
 * first, paged in from the server as the user scrolls (`useSessionFeed`).
 *
 * The header is a single element rather than list rows so the calendar keeps
 * its identity (and its heavy index) across page loads: only the rows below it
 * change.
 */
function SessionFeed({
  userID,
  header,
  isReady,
  contentContainerStyle,
}: SessionFeedProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {items, hasMore, isLoadingMore, loadMore} = useSessionFeed(userID);
  // One "now" for every card, so the relative days and the live duration
  // agree across the list. Taken when Home comes into view rather than on
  // every render (a render must stay pure), which is also when a stale "Today"
  // would first be noticed.
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, []),
  );

  const renderItem = useCallback(
    ({item}: ListRenderItemInfo<DrinkingSessionKeyValue>) => (
      <SessionFeedCard
        sessionId={item.sessionId}
        session={item.session}
        ownerID={userID}
        now={now}
      />
    ),
    [userID, now],
  );

  const listHeader = useMemo(
    () => (
      <View>
        {header}
        {isReady ? (
          <View style={styles.mt3} testID="session-feed">
            <FriendsDrinkingNow />
            <Text
              style={[
                styles.textLabelSupporting,
                styles.textStrong,
                styles.mb2,
              ]}>
              {translate('homeScreen.feed.title')}
            </Text>
          </View>
        ) : null}
      </View>
    ),
    [
      header,
      isReady,
      styles.mt3,
      styles.textLabelSupporting,
      styles.textStrong,
      styles.mb2,
      translate,
    ],
  );

  const listFooter = useMemo(() => {
    if (!isReady) {
      return null;
    }
    if (isLoadingMore) {
      return (
        <View style={[styles.alignItemsCenter, styles.p3]}>
          <ActivityIndicator
            size="small"
            color={theme.spinner}
            testID="session-feed-loading"
          />
        </View>
      );
    }
    if (items.length === 0 && !hasMore) {
      return (
        <Text
          style={[styles.textSupporting, styles.textAlignCenter, styles.p3]}
          testID="session-feed-empty">
          {translate('homeScreen.feed.empty')}
        </Text>
      );
    }
    return null;
  }, [
    isReady,
    isLoadingMore,
    items.length,
    hasMore,
    styles.alignItemsCenter,
    styles.p3,
    styles.textSupporting,
    styles.textAlignCenter,
    theme.spinner,
    translate,
  ]);

  // An empty list never reaches its end: `onEndReached` fires on scrolling past
  // content, so a snapshot holding no session (every session older than the
  // boot window, or an account with none yet) would leave the feed blank. Ask
  // for the first page once the feed is ready with nothing to show. Once per
  // empty state, so a page discarded offline does not loop; the next scroll or
  // a session arriving resets it.
  const hasRequestedInitialFillRef = useRef(false);
  useEffect(() => {
    if (items.length > 0) {
      hasRequestedInitialFillRef.current = false;
      return;
    }
    if (
      !isReady ||
      !hasMore ||
      isLoadingMore ||
      hasRequestedInitialFillRef.current
    ) {
      return;
    }
    hasRequestedInitialFillRef.current = true;
    loadMore();
  }, [isReady, items.length, hasMore, isLoadingMore, loadMore]);

  const onEndReached = useCallback(() => {
    if (!isReady) {
      return;
    }
    loadMore();
  }, [isReady, loadMore]);

  return (
    <FlashList
      data={isReady ? items : undefined}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      onEndReached={onEndReached}
      onEndReachedThreshold={END_REACHED_THRESHOLD}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
    />
  );
}

function keyExtractor(item: DrinkingSessionKeyValue): string {
  return item.sessionId;
}

SessionFeed.displayName = 'SessionFeed';
export default SessionFeed;
export type {SessionFeedProps};
