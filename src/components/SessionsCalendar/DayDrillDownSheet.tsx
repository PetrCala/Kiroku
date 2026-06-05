import {useEffect, useMemo} from 'react';
import {useIsFocused} from '@react-navigation/native';
import {FlatList, View} from 'react-native';
import {format} from 'date-fns';
import Button from '@components/Button';
import DrinkingSessionOverview from '@components/DrinkingSessionOverview';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import Icon from '@components/Icon';
import Modal from '@components/Modal';
import {PressableWithFeedback} from '@components/Pressable';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {dateStringToDate} from '@libs/DataHandling';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import CONST from '@src/CONST';
import type {DrinkingSessionList, Preferences} from '@src/types/onyx';
import type {DateString} from '@src/types/onyx/OnyxCommon';

type DayDrillDownSheetProps = {
  /** Whether the modal is visible */
  isVisible: boolean;

  /** Callback fired when the modal requests to close */
  onClose: () => void;

  /** The selected day, or null when no day is selected */
  date: DateString | null;

  /** The viewed user's drinking session data */
  drinkingSessionData: DrinkingSessionList | null | undefined;

  /** The viewed user's preferences, used for color/unit computation */
  preferences: Preferences;

  /** When true, the session tiles are interactive: tapping a tile opens its
   *  summary and an edit button is shown. When false (viewing another user's
   *  history) the tiles are read-only. */
  canEdit: boolean;
};

function DayDrillDownSheet({
  isVisible,
  onClose,
  date,
  drinkingSessionData,
  preferences,
  canEdit,
}: DayDrillDownSheetProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();

  const sessions = useMemo(() => {
    if (!date) {
      return [];
    }
    const relevantData = DSUtils.getSingleDayDrinkingSessions(
      dateStringToDate(date),
      drinkingSessionData ?? undefined,
      false,
    ) as DrinkingSessionList;
    return Object.entries(relevantData).map(([sessionId, session]) => ({
      sessionId,
      session,
    }));
  }, [date, drinkingSessionData]);

  const isFocused = useIsFocused();
  const hasSessions = sessions.length > 0;

  // Don't let the sheet reappear on a day whose last session was just removed
  // (deleted, or an edit moved it to another day) — clear the parent's date.
  // Guarded on `isVisible` so it only fires for an open sheet; `onClose` is
  // memoized by the parents, so this won't loop.
  useEffect(() => {
    if (isVisible && !hasSessions) {
      onClose();
    }
  }, [isVisible, hasSessions, onClose]);

  return (
    <Modal
      // Hide while the host screen is blurred (the user tapped through to a
      // session's summary/edit screen, which is presented over it in the RHP) so
      // the sheet doesn't float over the pushed screen, and reappears with live
      // data on return — unless the day has been emptied in the meantime.
      isVisible={isVisible && isFocused && hasSessions}
      onClose={onClose}
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
            {date
              ? format(dateStringToDate(date), CONST.DATE.SHORT_DATE_FORMAT)
              : ''}
          </Text>
          <PressableWithFeedback
            accessibilityLabel={translate('common.close')}
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.p2]}>
            <Icon src={KirokuIcons.Close} fill={theme.icon} />
          </PressableWithFeedback>
        </View>
        {sessions.length === 0 ? (
          <View style={[styles.flex1, styles.justifyContentCenter, styles.p5]}>
            <Text style={[styles.textSupporting, styles.textAlignCenter]}>
              {translate('dayOverviewScreen.noDrinkingSessions')}
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
                isEditModeOn={canEdit}
                readOnly={!canEdit}
                preferences={preferences}
              />
            )}
          />
        )}
        <View style={[styles.ph4, styles.mt2]}>
          <Button large text={translate('common.close')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

DayDrillDownSheet.displayName = 'DayDrillDownSheet';

export default DayDrillDownSheet;
