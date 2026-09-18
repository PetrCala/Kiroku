import type {ReactNode} from 'react';
import React, {useRef} from 'react';
import {View} from 'react-native';
import type {ValueOf} from 'type-fest';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import type CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import useSingleExecution from '@hooks/useSingleExecution';
import useWaitForNavigation from '@hooks/useWaitForNavigation';
import useActiveCentralPaneRoute from '@hooks/useActiveCentralPaneRoute';
import type {DrinkingSession, DrinkingSessionId} from '@src/types/onyx';
import DateUtils from '@libs/DateUtils';
import {
  isSessionPrivate,
  visibilityFromIsPrivate,
} from '@libs/SessionVisibility';
import * as DS from '@userActions/DrinkingSession';
import Text from './Text';
import MenuItem from './MenuItem';
import Switch from './Switch';

type MenuData = {
  translationKey: TranslationPaths;
  routeName?: Route;
  brickRoadIndicator?: ValueOf<typeof CONST.BRICK_ROAD_INDICATOR_STATUS>;
  action?: () => void;
  link?: string | (() => Promise<string>);
  shouldStackHorizontally?: boolean;
  title?: string;
  disabled?: boolean;
  description?: string;
  shouldShowRightComponent?: boolean;
  shouldShowRightIcon?: boolean;
  rightComponent?: ReactNode;
};

type SessionSliderProps = {
  sessionId: DrinkingSessionId;
  session: DrinkingSession;
  onBlackoutChange: (value: boolean) => void;
  shouldAllowDateChange?: boolean;
  shouldAllowTimezoneChange?: boolean;
};

function SessionDetailsWindow({
  sessionId,
  session,
  onBlackoutChange,
  shouldAllowDateChange,
  shouldAllowTimezoneChange,
}: SessionSliderProps) {
  const {translate} = useLocalize();
  const {singleExecution} = useSingleExecution();
  const waitForNavigate = useWaitForNavigation();
  const popoverAnchor = useRef(null);
  const activeCentralPaneRoute = useActiveCentralPaneRoute();
  const styles = useThemeStyles();

  const blackoutSwitch: ReactNode = (
    <Switch
      accessibilityLabel={translate('liveSessionScreen.blackoutSwitchLabel')}
      isOn={!!session.blackout}
      onToggle={value => onBlackoutChange(value)}
    />
  );

  // Visibility is one bit in the UI: private or not (RFC §4.2). Off is
  // `friends`, which is also what a session with no visibility means. This row
  // writes the change itself rather than taking a callback: the action needs
  // only the session this component already has, so there is nothing for the
  // parent to decide.
  const privateSwitch: ReactNode = (
    <Switch
      accessibilityLabel={translate('liveSessionScreen.privateSwitchLabel')}
      isOn={isSessionPrivate(session)}
      onToggle={value =>
        DS.updateSessionVisibility(
          sessionId,
          session,
          visibilityFromIsPrivate(value),
        )
      }
    />
  );

  const getRouteBackToThisScreen = (): Route => {
    const ongoing = !!session?.ongoing;

    return ongoing
      ? ROUTES.DRINKING_SESSION_LIVE.getRoute(sessionId)
      : ROUTES.DRINKING_SESSION_EDIT.getRoute(sessionId);
  };

  const sliderData: MenuData[] = [
    {
      translationKey: 'liveSessionScreen.private',
      description: translate('liveSessionScreen.privateDescription'),
      shouldShowRightComponent: true,
      rightComponent: privateSwitch,
      disabled: true,
    },
    {
      translationKey: 'liveSessionScreen.blackout',
      shouldShowRightComponent: true,
      rightComponent: blackoutSwitch,
      disabled: true,
    },
    {
      translationKey: 'liveSessionScreen.note',
      description: session.note ?? '',
      shouldShowRightIcon: true,
      routeName:
        ROUTES.DRINKING_SESSION_SESSION_NOTE_SCREEN.getRoute(sessionId),
    },
  ];

  if (shouldAllowDateChange) {
    sliderData.push({
      translationKey: 'common.date',
      shouldShowRightIcon: true,
      description: DateUtils.getLocalizedDay(
        session.start_time,
        session.timezone,
      ),
      routeName: ROUTES.DRINKING_SESSION_SESSION_DATE_SCREEN.getRoute(
        sessionId,
        getRouteBackToThisScreen(),
      ),
    });
  }

  if (shouldAllowTimezoneChange) {
    sliderData.push({
      translationKey: 'common.timezone',
      shouldShowRightIcon: true,
      description: session.timezone ?? '',
      routeName:
        ROUTES.DRINKING_SESSION_SESSION_TIMEZONE_SCREEN.getRoute(sessionId),
    });
  }

  return (
    <View style={styles.mh2}>
      <View style={styles.sessionDetailsWindowHeader}>
        <Text style={styles.headerText}>
          {translate('liveSessionScreen.sessionDetails')}
        </Text>
      </View>
      <View style={styles.w100}>
        {sliderData.map(item => {
          const keyTitle = item.translationKey
            ? translate(item.translationKey)
            : item.title;

          return (
            <MenuItem
              key={keyTitle}
              wrapperStyle={styles.sectionMenuItem}
              title={keyTitle}
              titleStyle={styles.plainSectionTitle}
              description={item.description}
              disabled={item.disabled}
              shouldGreyOutWhenDisabled={false}
              onPress={singleExecution(() => {
                if (item.action) {
                  item.action();
                } else {
                  waitForNavigate(() => {
                    Navigation.navigate(item.routeName);
                  })();
                }
              })}
              brickRoadIndicator={item.brickRoadIndicator}
              shouldStackHorizontally={item.shouldStackHorizontally}
              shouldShowRightIcon={item.shouldShowRightIcon}
              ref={popoverAnchor}
              hoverAndPressStyle={!item.disabled && styles.hoveredComponentBG}
              shouldBlockSelection={!!item.link}
              focused={
                !!activeCentralPaneRoute &&
                !!item.routeName &&
                !!(
                  activeCentralPaneRoute.name
                    .toLowerCase()
                    .replaceAll('_', '') ===
                  item.routeName.toLowerCase().replaceAll('/', '')
                )
              }
              isPaneMenu
              shouldShowRightComponent={item.shouldShowRightComponent}
              rightComponent={item.rightComponent}
            />
          );
        })}
      </View>
    </View>
  );
}

export default SessionDetailsWindow;
