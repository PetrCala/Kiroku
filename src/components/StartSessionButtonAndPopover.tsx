// Sourced from FloatingActionButtonAndPopover.tsx - see that file for more functionality
import {useIsFocused} from '@react-navigation/native';
import type {ForwardedRef} from 'react';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import * as DS from '@userActions/DrinkingSession';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as App from '@userActions/App';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useLocalize from '@hooks/useLocalize';
import usePrevious from '@hooks/usePrevious';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {DrinkingSessionType} from '@src/types/onyx';
import Log from '@libs/Log';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import DateUtils from '@libs/DateUtils';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import ERRORS from '@src/ERRORS';
import PopoverMenu from './PopoverMenu';
import type {PopoverMenuItem} from './PopoverMenu';
import FloatingActionButton from './FloatingActionButton';

// Utils

// To navigate with a delay
// setTimeout(() => {
//   Navigation.navigate(ROUTES.TRACK_TRAINING_MODAL);
// }, CONST.ANIMATED_TRANSITION);

type StartSessionButtonAndPopoverProps = {
  /* Callback function when the menu is shown */
  onShowCreateMenu?: () => void;

  /* Callback function before the menu is hidden */
  onHideCreateMenu?: () => void;
};

type StartSessionButtonAndPopoverRef = {
  hideCreateMenu: () => void;
};
/**
 * Responsible for rendering the {@link PopoverMenu}, and the accompanying
 * FAB that can open or close the menu.
 */
function StartSessionButtonAndPopover(
  {onHideCreateMenu, onShowCreateMenu}: StartSessionButtonAndPopoverProps,
  ref: ForwardedRef<StartSessionButtonAndPopoverRef>,
) {
  const styles = useThemeStyles();
  const {auth, db} = useFirebase();
  const {translate} = useLocalize();
  const user = auth.currentUser;
  const {userStatusData} = useDatabaseData();
  const userData = useCurrentUserData();
  const [ongoingSessionData] = useOnyx(ONYXKEYS.ONGOING_SESSION_DATA);
  const [startSession] = useOnyx(ONYXKEYS.START_SESSION_GLOBAL_CREATE);
  const [isCreateMenuActive, setIsCreateMenuActive] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const {windowHeight} = useWindowDimensions();
  const {shouldUseNarrowLayout} = useResponsiveLayout();
  const isFocused = useIsFocused();
  const prevIsFocused = usePrevious(isFocused);

  const startLiveDrinkingSession = async (): Promise<void> => {
    try {
      await App.setLoadingText(translate('liveSessionScreen.loading'));
      if (!ongoingSessionData?.ongoing) {
        await DS.startLiveDrinkingSession(
          db,
          user,
          userData?.timezone?.selected,
        );
      }
      DS.navigateToOngoingSessionScreen();
    } catch (error) {
      ErrorUtils.raiseAppError(ERRORS.SESSION.START_FAILED, error);
    }
  };

  const createEditDrinkingSession = async (): Promise<void> => {
    try {
      await App.setLoadingText(translate('common.loading'));
      await DS.setIsCreatingNewSession(true);
      const newSession = await DS.getNewSessionToEdit(
        db,
        auth.currentUser,
        new Date(),
        userData?.timezone?.selected,
      );
      if (!newSession?.id) {
        throw new Error('Failed to create a new session: no session ID');
      }
      Navigation.navigate(
        ROUTES.DRINKING_SESSION_SESSION_DATE_SCREEN.getRoute(
          newSession.id,
          ROUTES.HOME,
        ),
      );
    } catch (error) {
      await DS.setIsCreatingNewSession(false);
      ErrorUtils.raiseAppError(ERRORS.SESSION.START_FAILED, error);
    } finally {
      await App.setLoadingText(null);
    }
  };

  const renderSessionTypeTooltip = useCallback(
    () => null,
    // styles.sessionTypeTooltipTitle
    // styles.sessionTypeTooltipSubtitle
    [],
  );

  const selectOption = async (
    onSelected: () => Promise<void>,
    shouldRestrictAction?: boolean,
  ): Promise<void> => {
    if (shouldRestrictAction) {
      Log.warn("This is a restricted action. You can't do this.");
      // Navigation.navigate(
      //   ROUTES.RESTRICTED_ACTION.getRoute(someSessionId),
      // );
      return;
    }
    await onSelected();
  };

  const navigateToSessionType = useCallback(
    async (sessionType: DrinkingSessionType) => {
      // const sessionID = DSUtils.generateSessionID();

      switch (sessionType) {
        case CONST.SESSION.TYPES.LIVE:
          await selectOption(() => startLiveDrinkingSession());
          break;
        case CONST.SESSION.TYPES.EDIT:
          await selectOption(() => createEditDrinkingSession());
          break;
        default:
          Log.warn(`Unsupported session type: ${startSession?.sessionType}`);
      }
    },
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    [startSession?.sessionType, selectOption],
  );

  /**
   * Check if LHN status changed from active to inactive.
   * Used to close already opened FAB menu when open any other pages (i.e. Press Command + K on web).
   */
  const didScreenBecomeInactive = useCallback(
    (): boolean =>
      // When any other page is opened over LHN
      !isFocused && prevIsFocused,
    [isFocused, prevIsFocused],
  );

  /**
   * Method called when we click the floating action button
   */
  const showCreateMenu = useCallback(
    () => {
      if (!isFocused && shouldUseNarrowLayout) {
        return;
      }
      setIsCreateMenuActive(true);
      onShowCreateMenu?.();
    },
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    [isFocused, shouldUseNarrowLayout],
  );

  /**
   * Method called either when:
   * - Pressing the floating action button to open the CreateMenu modal
   * - Selecting an item on CreateMenu or closing it by clicking outside of the modal component
   */
  const hideCreateMenu = useCallback(
    () => {
      if (!isCreateMenuActive) {
        return;
      }
      setIsCreateMenuActive(false);
      onHideCreateMenu?.();
    },
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    [isCreateMenuActive],
  );

  useEffect(() => {
    if (!didScreenBecomeInactive()) {
      return;
    }

    // Hide menu manually when other pages are opened using shortcut key
    hideCreateMenu();
  }, [didScreenBecomeInactive, hideCreateMenu]);

  useImperativeHandle(ref, () => ({
    hideCreateMenu() {
      hideCreateMenu();
    },
  }));

  const toggleCreateMenu = () => {
    if (isCreateMenuActive) {
      hideCreateMenu();
    } else {
      showCreateMenu();
    }
  };

  const [ongoingSessionMenuItems, staticSessionTypeMenuItems] = useMemo(() => {
    const getBaseSessionType = (sessionType: DrinkingSessionType) => ({
      isLabelHoverable: false,
      numberOfLinesDescription: 2,
      tooltipAnchorAlignment: {
        vertical: CONST.MODAL.ANCHOR_ORIGIN_VERTICAL.BOTTOM,
        horizontal: CONST.MODAL.ANCHOR_ORIGIN_HORIZONTAL.LEFT,
      },
      tooltipShiftHorizontal: styles.popoverMenuItem.paddingHorizontal,
      tooltipShiftVertical: styles.popoverMenuItem.paddingVertical / 2,
      renderTooltipContent: renderSessionTypeTooltip,
      tooltipWrapperStyle: styles.sessionTypeTooltipWrapper,
      onSelected: async () => {
        await navigateToSessionType(sessionType);
        hideCreateMenu();
      },
      shouldRenderTooltip: false, // or whatever your logic might be
      text: translate(DSUtils.getSessionTypeTitle(sessionType)),
    });

    const session = userStatusData?.latest_session;
    let ongoingItems: PopoverMenuItem[] = [];

    if (session?.ongoing && session.type) {
      const sessionStartTime = DateUtils.getLocalizedTime(
        session.start_time,
        userData?.timezone?.selected,
      );

      ongoingItems = [
        {
          ...getBaseSessionType(session.type),
          label: translate('startSession.ongoingSessions'),
          icon: DSUtils.getIconForSession(session.type),
          description: translate('startSession.sessionFrom', {
            startTime: sessionStartTime,
          }),
        },
      ];
    }

    const sessionTypes = Object.values(CONST.SESSION.TYPES).filter(
      type =>
        // Only show non-ongoing session types
        !session?.ongoing || type !== session?.type,
    );

    const staticItems: PopoverMenuItem[] = sessionTypes.map(
      (sessionType, index) => ({
        ...getBaseSessionType(sessionType),
        label:
          index === 0 ? translate('startSession.startNewSession') : undefined,
        icon: DSUtils.getIconForSession(sessionType),
        description: translate(DSUtils.getSessionTypeDescription(sessionType)),
      }),
    );

    return [ongoingItems, staticItems];
  }, [
    userStatusData,
    userData?.timezone?.selected,
    hideCreateMenu,
    navigateToSessionType,
    renderSessionTypeTooltip,
    styles.popoverMenuItem.paddingHorizontal,
    styles.popoverMenuItem.paddingVertical,
    styles.sessionTypeTooltipWrapper,
    translate,
  ]);

  return (
    <View style={[styles.flexShrink1, styles.ph2]}>
      <PopoverMenu
        onClose={hideCreateMenu}
        isVisible={isCreateMenuActive && (!shouldUseNarrowLayout || isFocused)}
        anchorPosition={styles.createMenuPositionSidebar(windowHeight)}
        onItemSelected={hideCreateMenu}
        fromSidebarMediumScreen={!shouldUseNarrowLayout}
        menuItems={[
          // ...(condition ? [{icon: ..., ...}] : []) // to add items conditionally
          ...ongoingSessionMenuItems,
          ...staticSessionTypeMenuItems,
        ]}
        withoutOverlay
        anchorRef={fabRef}
      />
      <FloatingActionButton
        accessibilityLabel={translate('startSession.newSessionExplained')}
        role={CONST.ROLE.BUTTON}
        isActive={isCreateMenuActive}
        ref={fabRef}
        onPress={toggleCreateMenu}
      />
    </View>
  );
}

StartSessionButtonAndPopover.displayName = 'StartSessionButtonAndPopover';

export default forwardRef(StartSessionButtonAndPopover);
