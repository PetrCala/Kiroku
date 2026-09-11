import {useMemo} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import useAddDrinks from '@hooks/useAddDrinks';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import useCurrentUserPreferences from '@hooks/useCurrentUserPreferences';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {findDrinkNameTranslationKey} from '@libs/DataHandling';
import DrinkData from '@libs/DrinkData';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import getUsualDrinkKeys from '@libs/getUsualDrinkKeys';
import * as DS from '@userActions/DrinkingSession';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import Text from './Text';
import {PressableWithFeedback} from './Pressable';
import * as KirokuIcons from './Icon/KirokuIcons';
import Icon from './Icon';
import ElapsedTime from './ElapsedTime';

const CARD_RADIUS = 12;
const QUICK_ADD_RADIUS = 8;
const LIVE_DOT_SIZE = 8;
const CHEVRON_SIZE = 16;
const QUICK_ADD_ICON_SIZE = 22;
const QUICK_ADD_PLUS_SIZE = 12;

/**
 * The top of Home while a session is live: how long it has been running, the
 * units so far, and one-tap adds for the user's usual drinks. Tapping the card
 * opens the live session. It reads the live buffer itself, so a quick-add
 * re-renders this card, not Home, and the timer ticks inside `ElapsedTime`
 * only.
 */
function LiveSessionCard() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const [session] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
  const preferences = useCurrentUserPreferences();
  const drinkingSessions = useCurrentUserDrinkingSessions();
  const addDrinks = useAddDrinks(session);
  const usualDrinkKeys = useMemo(
    () => getUsualDrinkKeys(drinkingSessions),
    [drinkingSessions],
  );

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
      <View style={[styles.flexRow, styles.gap2, styles.ph3, styles.pb3]}>
        {usualDrinkKeys.map(drinkKey => {
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
              wrapperStyle={styles.flex1}
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
              <View
                style={[styles.flexRow, styles.alignItemsCenter, styles.gap1]}>
                {!!icon && (
                  <Icon
                    src={icon}
                    width={QUICK_ADD_ICON_SIZE}
                    height={QUICK_ADD_ICON_SIZE}
                    fill={theme.text}
                  />
                )}
                <Icon
                  src={KirokuIcons.Plus}
                  width={QUICK_ADD_PLUS_SIZE}
                  height={QUICK_ADD_PLUS_SIZE}
                  fill={theme.text}
                />
              </View>
              {/* Small beer and beer share an icon, so the name disambiguates. */}
              <Text style={[styles.textMicro, styles.mt1]} numberOfLines={1}>
                {drinkName}
              </Text>
            </PressableWithFeedback>
          );
        })}
      </View>
    </View>
  );
}

LiveSessionCard.displayName = 'LiveSessionCard';

export default LiveSessionCard;
