import React from 'react';
import {View} from 'react-native';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import Image from '@components/Image';
import RESIZE_MODES from '@components/Image/resizeModes';
import {PressableWithFeedback} from '@components/Pressable';
import useSessionPhotoUrls from '@components/SessionPhotoGallery/useSessionPhotoUrls';
import Text from '@components/Text';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import useLocalize from '@hooks/useLocalize';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {convertUnitsToColors} from '@libs/DataHandling';
import DrinkData from '@libs/DrinkData';
import {formatRelativeDay} from '@libs/formatRelativeDay';
import formatSessionDuration from '@libs/formatSessionDuration';
import Navigation from '@libs/Navigation/Navigation';
import {resolvePalette} from '@libs/SessionColorPalettes';
import {buildFeedCardSummary} from '@libs/SessionFeed';
import * as DS from '@userActions/DrinkingSession';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type {DrinkingSession, DrinkingSessionId} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';

const THUMBNAIL_SIZE = 56;
const THUMBNAIL_RADIUS = 8;
const DRINK_ICON_SIZE = 16;
const LIVE_DOT_SIZE = 6;

type SessionFeedCardProps = {
  sessionId: DrinkingSessionId;
  session: DrinkingSession;

  /** The session's owner: the signed-in user for the Home feed. */
  ownerID: UserID;

  /** "Now", snapshotted by the list so every card measures against the same instant. */
  now: number;
};

/**
 * The photo thumbnail of a card, on a session that has one. Its own component
 * so a card without photos never subscribes to the signed-url fetch (the urls
 * are short-lived and private, see `useSessionPhotoUrls`).
 */
function SessionFeedThumbnail({
  sessionId,
  session,
  photoId,
}: Pick<SessionFeedCardProps, 'sessionId' | 'session'> & {photoId: string}) {
  const theme = useTheme();
  const styles = useThemeStyles();
  const {photos} = useSessionPhotoUrls(sessionId, session.photos);
  const url = photos[photoId]?.url;
  return (
    <View
      style={[
        styles.mr3,
        styles.overflowHidden,
        {
          width: THUMBNAIL_SIZE,
          height: THUMBNAIL_SIZE,
          borderRadius: THUMBNAIL_RADIUS,
          backgroundColor: theme.cardSoftBG,
        },
      ]}
      testID={`session-feed-thumbnail-${sessionId}`}>
      {url ? (
        <Image
          source={{uri: url}}
          style={{width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE}}
          resizeMode={RESIZE_MODES.cover}
        />
      ) : null}
    </View>
  );
}

/**
 * One session in the Home feed (RFC §10): its name, when it was, how long it
 * ran, what it added up to and what was drunk, with a photo thumbnail and a
 * live badge when they apply. Everything on it is computed here from the
 * session record, at today's scale (`buildFeedCardSummary`); nothing is
 * denormalised yet.
 *
 * Tapping a finished session opens its detail page. Tapping the live one opens
 * the live screen, which reads the live buffer Home keeps in step with the
 * snapshot, so the card never has to swap sessions into that buffer itself.
 */
function SessionFeedCard({
  sessionId,
  session,
  ownerID,
  now,
}: SessionFeedCardProps) {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const theme = useTheme();
  const {translate} = useLocalize();
  const preferences = useCurrentUserPreferences();

  const summary = buildFeedCardSummary(sessionId, session, {
    drinksToUnits: preferences?.drinks_to_units,
    drinkDefaults: CONST.DRINK_DEFAULTS,
    ownerUid: ownerID,
    now,
  });

  const accentColor = summary.blackout
    ? resolvePalette(preferences?.session_color_palette).black
    : convertUnitsToColors(
        summary.units,
        preferences?.units_to_colors,
        preferences?.session_color_palette,
      );

  const when = formatRelativeDay(summary.startTime, new Date(now), translate);
  const duration = formatSessionDuration(summary.durationMs);
  const units = translate('homeScreen.liveSessionCard.units', {
    unitCount: summary.units,
  });
  const sdu =
    summary.sdu === undefined
      ? undefined
      : translate('homeScreen.feed.sdu', {sdu: summary.sdu});

  const onPress = () => {
    if (summary.isLive) {
      DS.navigateToOngoingSessionScreen();
      return;
    }
    Navigation.navigate(ROUTES.DRINKING_SESSION_SUMMARY.getRoute(sessionId));
  };

  return (
    <PressableWithFeedback
      accessibilityLabel={translate('homeScreen.feed.cardA11y', {
        name: summary.name,
        when,
        units: summary.units,
      })}
      accessibilityRole={CONST.ROLE.BUTTON}
      onPress={onPress}
      testID={`session-feed-card-${sessionId}`}
      style={[
        styles.flexRow,
        styles.alignItemsCenter,
        styles.p3,
        styles.mb2,
        StyleUtils.getColorAccentRowStyle(accentColor),
      ]}>
      {summary.photoId ? (
        <SessionFeedThumbnail
          sessionId={sessionId}
          session={session}
          photoId={summary.photoId}
        />
      ) : null}
      <View style={styles.flex1}>
        <View style={[styles.flexRow, styles.alignItemsCenter]}>
          <Text
            style={[styles.textNormal, styles.textStrong, styles.flexShrink1]}
            numberOfLines={1}
            testID={`session-feed-name-${sessionId}`}>
            {summary.name}
          </Text>
          {summary.isLive ? (
            <View
              style={[styles.flexRow, styles.alignItemsCenter, styles.ml2]}
              testID={`session-feed-live-${sessionId}`}>
              <View
                style={[
                  styles.mr1,
                  {
                    width: LIVE_DOT_SIZE,
                    height: LIVE_DOT_SIZE,
                    borderRadius: LIVE_DOT_SIZE / 2,
                    backgroundColor: theme.danger,
                  },
                ]}
              />
              <Text
                style={[
                  styles.textMicroSupporting,
                  styles.textStrong,
                  {color: theme.danger},
                ]}>
                {translate('homeScreen.feed.live')}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[styles.textMicroSupporting, styles.mt1]}
          numberOfLines={1}>
          {`${when} · ${duration}`}
        </Text>
        <View style={[styles.flexRow, styles.alignItemsCenter, styles.mt1]}>
          <Text
            style={[styles.textLabelSupporting, styles.flexShrink1]}
            numberOfLines={1}
            testID={`session-feed-units-${sessionId}`}>
            {sdu ? `${units} · ${sdu}` : units}
          </Text>
          {summary.drinkCounts.length > 0 && (
            <View style={[styles.flexRow, styles.alignItemsCenter, styles.ml2]}>
              {summary.drinkCounts.map(({key, count}) => {
                const icon = DrinkData.find(drink => drink.key === key)?.icon;
                if (!icon) {
                  return null;
                }
                return (
                  <View
                    key={key}
                    style={[
                      styles.flexRow,
                      styles.alignItemsCenter,
                      styles.ml1,
                    ]}>
                    <Icon
                      src={icon}
                      fill={theme.textSupporting}
                      width={DRINK_ICON_SIZE}
                      height={DRINK_ICON_SIZE}
                    />
                    <Text style={styles.textMicroSupporting}>{count}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
      <Icon
        src={KirokuIcons.ArrowRight}
        fill={theme.icon}
        width={DRINK_ICON_SIZE}
        height={DRINK_ICON_SIZE}
      />
    </PressableWithFeedback>
  );
}

SessionFeedCard.displayName = 'SessionFeedCard';
export default React.memo(SessionFeedCard);
export type {SessionFeedCardProps};
