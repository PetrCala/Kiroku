import {formatInTimeZone} from 'date-fns-tz';
import React, {useMemo} from 'react';
import {View} from 'react-native';
import {KpiCard, KpiCardGroup} from '@components/Charts/KpiCard';
import type {KpiCardProps} from '@components/Charts/KpiCard';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useLocalize from '@hooks/useLocalize';
import useDrinkEvents from '@hooks/useStatistics/useDrinkEvents';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {computeBadges, summarizeAchievements} from '@libs/AchievementsUtils';
import type {BadgeStatus} from '@libs/AchievementsUtils';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';

function AchievementsScreen() {
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const theme = useTheme();
  const {events, isLoading} = useDrinkEvents();
  const userData = useCurrentUserData();

  const timezone =
    userData?.timezone?.selected ?? CONST.DEFAULT_TIME_ZONE.selected;

  // Snapshot `now` once per mount so the streak math is stable across renders.
  const now = useMemo(() => new Date(), []);
  const todayKey = useMemo(
    () => formatInTimeZone(now, timezone, 'yyyy-MM-dd'),
    [now, timezone],
  );

  const summary = useMemo(
    () => summarizeAchievements(events, todayKey),
    [events, todayKey],
  );
  const badges = useMemo(() => computeBadges(summary), [summary]);

  const dayUnit = (count: number) =>
    translate('achievementsScreen.dayUnit', {count});

  const statCards: KpiCardProps[] = [
    {
      label: translate('achievementsScreen.stats.longestStreak'),
      value: summary.longestAfStreak,
      unit: dayUnit(summary.longestAfStreak),
      tone: 'celebratory',
      polarity: 'higher-is-supportive',
    },
    {
      label: translate('achievementsScreen.stats.totalAfDays'),
      value: summary.totalAfDays,
      unit: dayUnit(summary.totalAfDays),
      polarity: 'higher-is-supportive',
    },
    {
      label: translate('achievementsScreen.stats.sessions'),
      value: summary.totalSessions,
      polarity: 'neutral',
    },
  ];

  const renderBadge = (badge: BadgeStatus) => (
    <View
      key={badge.id}
      style={[
        styles.flexRow,
        styles.alignItemsCenter,
        styles.p3,
        styles.mb2,
        {backgroundColor: theme.highlightBG, borderRadius: 12},
      ]}>
      <Icon
        src={KirokuIcons.Star}
        fill={badge.earned ? theme.success : theme.icon}
        width={28}
        height={28}
      />
      <View style={[styles.flex1, styles.ml3]}>
        <Text style={[styles.textStrong]} numberOfLines={1}>
          {translate(`achievementsScreen.badges.${badge.id}.title`)}
        </Text>
        <Text style={[styles.textLabelSupporting]}>
          {translate(`achievementsScreen.badges.${badge.id}.description`)}
        </Text>
      </View>
      {badge.earned ? (
        <Icon
          src={KirokuIcons.Checkmark}
          fill={theme.success}
          width={20}
          height={20}
        />
      ) : (
        <Text style={[styles.textMicroSupporting, styles.ml2]}>
          {`${badge.current}/${badge.target}`}
        </Text>
      )}
    </View>
  );

  return (
    <ScreenWrapper testID={AchievementsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('achievementsScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      {!isLoading && !summary.hasData ? (
        <View
          style={[
            styles.flex1,
            styles.alignItemsCenter,
            styles.justifyContentCenter,
            styles.ph5,
          ]}>
          <Icon
            src={KirokuIcons.Star}
            fill={theme.icon}
            width={48}
            height={48}
          />
          <Text style={[styles.textAlignCenter, styles.mt3]}>
            {translate('achievementsScreen.empty')}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={[styles.p4]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.mb3}>
            <KpiCard
              label={translate('achievementsScreen.streak.label')}
              value={summary.currentAfStreak}
              unit={dayUnit(summary.currentAfStreak)}
              tone="celebratory"
              polarity="higher-is-supportive"
              isLoading={isLoading}
            />
          </View>

          <View style={styles.mb3}>
            <KpiCardGroup cards={statCards} isLoading={isLoading} />
          </View>

          {!isLoading ? (
            <View>
              <Text
                style={[
                  styles.textLabelSupporting,
                  styles.textStrong,
                  styles.mb2,
                ]}>
                {translate('achievementsScreen.badgesTitle')}
              </Text>
              {badges.map(renderBadge)}
            </View>
          ) : null}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

AchievementsScreen.displayName = 'Achievements Screen';
export default AchievementsScreen;
