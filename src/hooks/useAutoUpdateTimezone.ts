import {useEffect} from 'react';
import useCurrentUserData from '@hooks/useCurrentUserData';
import DateUtils from '@libs/DateUtils';
import {getDeviceTimezone} from '@libs/TimezoneUtils';
import * as UserData from '@userActions/UserData';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import useAppFocusEvent from './useAppFocusEvent';

/**
 * Keeps the stored timezone in sync with the device when the user's timezone is
 * set to update automatically. Runs once user data is loaded (login) and each
 * time the app returns to the foreground, so crossing a timezone boundary with
 * the app already warm is reflected without a restart. Foreground auto-updates
 * are throttled via DateUtils.canUpdateTimezone.
 *
 * The device timezone is normalized before comparison so a deprecated IANA name
 * (which the action rewrites to its modern equivalent on write) does not trigger
 * an endless update loop.
 */
function useAutoUpdateTimezone() {
  const currentUserData = useCurrentUserData();
  const timezone = currentUserData?.timezone;
  const isUserDataLoaded = !isEmptyObject(currentUserData);

  const updateTimezone = () => {
    // Validated before it is persisted: a name this engine will not accept back
    // as a `timeZone` option would be written to the user's profile and then
    // throw out of every formatter that reads it. See `@libs/TimezoneUtils`.
    const deviceTimezone = getDeviceTimezone();

    const proposedTimezone = DateUtils.formatToSupportedTimezone({
      automatic: true,
      selected: deviceTimezone,
    });

    // First-set: no timezone stored yet → default to automatic on this device.
    if (!timezone?.selected) {
      UserData.updateAutomaticTimezone(proposedTimezone);
      DateUtils.setTimezoneUpdated();
      return;
    }

    // Auto-update: only when automatic, the device actually moved, and we are
    // outside the throttle window.
    if (
      timezone.automatic &&
      timezone.selected !== proposedTimezone.selected &&
      DateUtils.canUpdateTimezone()
    ) {
      UserData.updateAutomaticTimezone(proposedTimezone);
      DateUtils.setTimezoneUpdated();
    }
  };

  useAppFocusEvent(updateTimezone);

  useEffect(() => {
    if (!isUserDataLoaded) {
      // Wait until user data has hydrated before attempting any sync.
      return;
    }
    updateTimezone();
    // `updateTimezone` reads fresh values on each render; only re-run the
    // login-time sync when user data first becomes available.
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
  }, [isUserDataLoaded]);
}

export default useAutoUpdateTimezone;
