import React, {useCallback, useEffect, useMemo} from 'react';
import {View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useOnyx} from 'react-native-onyx';
import Button from '@components/Button';
import {PressableWithFeedback} from '@components/Pressable';
import Text from '@components/Text';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import getPlatform from '@libs/getPlatform';
import {
  canOpenTipJarPrompt,
  shouldShowTipJarPrompt,
} from '@libs/TipJarPromptUtils';
import type {TipJarPromptState} from '@libs/TipJarPromptUtils';
import {getCurrentUserSupporterStatus} from '@libs/UserUtils';
import * as TipJarPromptActions from '@userActions/TipJarPrompt';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

/**
 * The one gated ask for the tip jar, rendered on Home between the session
 * banner and the monthly overview. It opens when Home regains focus after a
 * session summary closed (the moment `SessionSummaryScreen` arms) and every
 * gate in `canOpenTipJarPrompt` holds; it then stays until answered. The
 * rules and their numbers are in contributingGuides/TIP_JAR.md.
 *
 * Renders nothing on web (tips are sold in the mobile app only) and whenever
 * the card is not open.
 */
function TipJarPromptCard() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const [prompt, promptMetadata] = useOnyx(ONYXKEYS.TIP_JAR_PROMPT, {
    canBeMissing: true,
  });
  const [tipsGiven] = useOnyx(ONYXKEYS.TIPS_GIVEN, {canBeMissing: true});
  const [ongoingSessionData] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA, {
    canBeMissing: true,
  });
  const [privateData] = useOnyx(ONYXKEYS.USER_PRIVATE_DATA, {
    canBeMissing: true,
  });
  const drinkingSessionData = useCurrentUserDrinkingSessions();

  const isPromptLoaded = promptMetadata.status !== 'loading';
  const firstOpenAt = prompt?.firstOpenAt;
  const shownCount = prompt?.shownCount ?? 0;
  const completedSessionCount = useMemo(
    () => DSUtils.countCompletedSessions(drinkingSessionData),
    [drinkingSessionData],
  );
  const isSupporter = getCurrentUserSupporterStatus(privateData).is_supporter;
  const hasOngoingSession = !!ongoingSessionData?.ongoing;
  const isTipJarAvailable = getPlatform() !== CONST.PLATFORM.WEB;
  const state = useMemo<TipJarPromptState>(
    () => ({
      prompt,
      completedSessionCount,
      tipsGiven: tipsGiven ?? 0,
      isSupporter,
      hasOngoingSession,
      isTipJarAvailable,
    }),
    [
      prompt,
      completedSessionCount,
      tipsGiven,
      isSupporter,
      hasOngoingSession,
      isTipJarAvailable,
    ],
  );

  // Start the 14-day clock the first time Home renders on this device. Waits
  // for the stored value so a cold start never overwrites an earlier stamp.
  useEffect(() => {
    if (!isPromptLoaded) {
      return;
    }
    TipJarPromptActions.recordFirstOpen(firstOpenAt);
  }, [isPromptLoaded, firstOpenAt]);

  // The moment: Home regained focus after a session summary closed. Spend it
  // on this focus whether or not the gates hold, so a "no" now doesn't turn
  // into a "yes" on some later, unrelated return to Home.
  useFocusEffect(
    useCallback(() => {
      if (!isPromptLoaded || !TipJarPromptActions.consumeMoment()) {
        return;
      }
      if (canOpenTipJarPrompt({...state, now: Date.now()})) {
        TipJarPromptActions.open(shownCount);
      }
    }, [isPromptLoaded, state, shownCount]),
  );

  if (!shouldShowTipJarPrompt(state)) {
    return null;
  }

  return (
    <View
      style={[
        styles.mt2,
        styles.p3,
        {backgroundColor: theme.cardSoftBG, borderRadius: 12},
      ]}>
      <Text style={[styles.textStrong, styles.mb1]}>
        {translate('supporter.tipJarPrompt.title', {
          sessionCount: completedSessionCount,
        })}
      </Text>
      <Text style={[styles.textLabelSupporting, styles.mb3]}>
        {translate('supporter.tipJarPrompt.body')}
      </Text>
      <View style={[styles.flexRow, styles.gap2]}>
        <Button
          success
          small
          style={styles.flex1}
          text={translate('supporter.tipJarPrompt.accept')}
          onPress={() => TipJarPromptActions.acceptAndOpenSupport()}
        />
        <Button
          small
          style={styles.flex1}
          text={translate('supporter.tipJarPrompt.notNow')}
          onPress={() => TipJarPromptActions.dismiss()}
        />
      </View>
      <PressableWithFeedback
        accessibilityLabel={translate('supporter.tipJarPrompt.never')}
        role={CONST.ROLE.BUTTON}
        onPress={() => TipJarPromptActions.dismissForever()}
        style={[styles.alignSelfCenter, styles.mt3]}>
        <Text style={styles.textMicroSupporting}>
          {translate('supporter.tipJarPrompt.never')}
        </Text>
      </PressableWithFeedback>
    </View>
  );
}

TipJarPromptCard.displayName = 'TipJarPromptCard';

export default TipJarPromptCard;
