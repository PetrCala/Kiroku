import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import {useFocusEffect} from '@react-navigation/native';
import useAddDrinks from '@hooks/useAddDrinks';
import useAppFocusEvent from '@hooks/useAppFocusEvent';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {findDrinkNameTranslationKey} from '@libs/DataHandling';
import DrinkData from '@libs/DrinkData';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import {buildDrinkProfile, rankQuickAdd} from '@libs/DrinkRanking';
import * as DS from '@userActions/DrinkingSession';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DrinkKey} from '@src/types/onyx';
import Text from './Text';
import {PressableWithFeedback} from './Pressable';
import * as KirokuIcons from './Icon/KirokuIcons';
import Icon from './Icon';
import ElapsedTime from './ElapsedTime';
import ScrollView from './ScrollView';

const CARD_RADIUS = 12;
const QUICK_ADD_RADIUS = 8;
const LIVE_DOT_SIZE = 8;
const CHEVRON_SIZE = 16;
const QUICK_ADD_ICON_SIZE = 22;
const QUICK_ADD_PLUS_SIZE = 16;
/**
 * Every chip is at least this wide, so the row overflows the card on a phone
 * and the chip cut off at the edge shows there is more to scroll to.
 */
const QUICK_ADD_MIN_WIDTH = 80;

/**
 * The top of Home while a session is live: how long it has been running, the
 * units so far, and one-tap adds for every drink type, the most likely first
 * (`rankQuickAdd`): the drink logged last in this session sits at the front and
 * the rest follow the user's habits for the time of day the session started.
 *
 * The row keeps its order while it is on screen, so a chip never moves from
 * under the user's finger; it is re-ranked only when Home comes back into view
 * (focus, the app returning to the foreground) and when a new session starts.
 *
 * Tapping the card opens the live session. It reads the live buffer itself, so
 * a quick-add re-renders this card, not Home, and the timer ticks inside
 * `ElapsedTime` only.
 */
function LiveSessionCard() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const [session] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
  const preferences = useCurrentUserPreferences();
  const drinkingSessions = useCurrentUserDrinkingSessions();
  const addDrinks = useAddDrinks(session);
  const drinkProfile = useMemo(
    () => buildDrinkProfile(drinkingSessions),
    [drinkingSessions],
  );

  // The re-rank triggers read the latest inputs through a ref, so they don't
  // re-run on every tap (each tap changes `session`).
  const rankInputs = useRef({drinkProfile, session});
  useEffect(() => {
    rankInputs.current = {drinkProfile, session};
  });
  const [quickAddKeys, setQuickAddKeys] = useState<DrinkKey[]>(() =>
    rankQuickAdd(drinkProfile, session),
  );
  const reRank = useCallback(() => {
    const inputs = rankInputs.current;
    setQuickAddKeys(rankQuickAdd(inputs.drinkProfile, inputs.session));
  }, []);
  useFocusEffect(reRank);
  useAppFocusEvent(reRank);
  const sessionID = session?.id;
  useEffect(() => {
    reRank();
  }, [sessionID, reRank]);

  if (!session?.ongoing) {
    return null;
  }

  const totalUnits = DSUtils.calculateTotalUnits(
    session.drinks,
    preferences?.drinks_to_units,
    true,
  );

  return (
    <View
      style={[
        styles.mt2,
        {backgroundColor: theme.cardSoftBG, borderRadius: CARD_RADIUS},
      ]}>
      <PressableWithFeedback
        accessibilityLabel={translate('homeScreen.liveSessionCard.a11y', {
          unitCount: totalUnits,
        })}
        accessibilityRole={CONST.ROLE.BUTTON}
        onPress={() => DS.navigateToOngoingSessionScreen()}
        testID="live-session-card"
        style={[
          styles.p3,
          styles.flexRow,
          styles.alignItemsCenter,
          styles.justifyContentBetween,
        ]}>
        <View style={styles.flexShrink1}>
          <View style={[styles.flexRow, styles.alignItemsCenter, styles.mb1]}>
            <View
              style={[
                styles.mr2,
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
                styles.textLabelSupporting,
                styles.textStrong,
                {color: theme.danger},
              ]}
              numberOfLines={1}>
              {translate('homeScreen.liveSessionCard.label')}
            </Text>
          </View>
          <View style={[styles.flexRow, styles.alignItemsBaseline]}>
            <ElapsedTime
              startTime={session.start_time}
              style={styles.textHeadlineH2}
              testID="live-session-card-elapsed"
            />
            <Text
              style={[styles.textSupporting, styles.ml3]}
              numberOfLines={1}
              testID="live-session-card-units">
              {translate('homeScreen.liveSessionCard.units', {
                unitCount: totalUnits,
              })}
            </Text>
          </View>
        </View>
        <View style={[styles.flexRow, styles.alignItemsCenter, styles.ml2]}>
          <Text style={[styles.textStrong, styles.mr1, {color: theme.danger}]}>
            {translate('homeScreen.liveSessionCard.open')}
          </Text>
          <Icon
            src={KirokuIcons.ArrowRight}
            width={CHEVRON_SIZE}
            height={CHEVRON_SIZE}
            fill={theme.danger}
          />
        </View>
      </PressableWithFeedback>
      <View style={[styles.flexRow, styles.alignItemsCenter, styles.pb3]}>
        {/* Said once for the whole row instead of on every chip: a tap adds. */}
        <View style={[styles.pl3, styles.pr2]}>
          <Icon
            src={KirokuIcons.Plus}
            width={QUICK_ADD_PLUS_SIZE}
            height={QUICK_ADD_PLUS_SIZE}
            fill={theme.textSupporting}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.flex1}
          contentContainerStyle={[styles.gap2, styles.pr3]}
          testID="live-session-card-quick-add">
          {quickAddKeys.map(drinkKey => {
            const drinkName = translate(findDrinkNameTranslationKey(drinkKey));
            const icon = DrinkData.find(drink => drink.key === drinkKey)?.icon;
            return (
              <PressableWithFeedback
                key={drinkKey}
                accessibilityLabel={translate(
                  'homeScreen.liveSessionCard.addDrink',
                  {drinkName},
                )}
                accessibilityRole={CONST.ROLE.BUTTON}
                onPress={() => addDrinks(drinkKey, 1)}
                testID={`live-session-card-add-${drinkKey}`}
                wrapperStyle={{minWidth: QUICK_ADD_MIN_WIDTH}}
                style={[
                  styles.alignItemsCenter,
                  styles.justifyContentCenter,
                  styles.pv2,
                  styles.ph1,
                  {
                    backgroundColor: theme.buttonDefaultBG,
                    borderRadius: QUICK_ADD_RADIUS,
                  },
                ]}>
                {!!icon && (
                  <Icon
                    src={icon}
                    width={QUICK_ADD_ICON_SIZE}
                    height={QUICK_ADD_ICON_SIZE}
                    fill={theme.text}
                  />
                )}
                {/* Small beer and beer share an icon, so the name disambiguates. */}
                <Text style={[styles.textMicro, styles.mt1]} numberOfLines={1}>
                  {drinkName}
                </Text>
              </PressableWithFeedback>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

LiveSessionCard.displayName = 'LiveSessionCard';

export default LiveSessionCard;
