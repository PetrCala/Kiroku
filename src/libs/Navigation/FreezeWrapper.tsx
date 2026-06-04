import {useIsFocused} from '@react-navigation/native';
import React, {useEffect} from 'react';
import {Freeze} from 'react-freeze';
import type ChildrenProps from '@src/types/utils/ChildrenProps';
import liveTapLog from '@libs/liveTapDebug';

type FreezeWrapperProps = ChildrenProps & {
  /** Prop to disable freeze */
  keepVisible?: boolean;
};

// Freeze the wrapped subtree (via react-freeze) whenever this screen is not the
// focused/top screen — i.e. another screen (a right-hand modal such as the live
// drinking-session screen) is on top of it. While frozen, react-freeze suspends
// the subtree's renders and effects, so occluded screens stop re-rendering on
// Onyx echoes (and stop running effects like HomeScreen's syncLocalLiveSessionData)
// that would otherwise block the JS thread under the modal.
//
// We derive `freeze` straight from `useIsFocused()`. The previous navigation-state
// `addListener('state', …)` approach was unreliable: the listener was re-created on
// every focus change, so it missed the very push event that should have frozen the
// screen and the freeze never engaged.
function FreezeWrapper({keepVisible = false, children}: FreezeWrapperProps) {
  const isFocused = useIsFocused();
  const freeze = !isFocused && !keepVisible;

  // TEMP [live-tap] instrumentation — remove with the rest of the debug logging.
  useEffect(() => {
    liveTapLog('FreezeWrapper.freeze', {freeze, isFocused});
  }, [freeze, isFocused]);

  return <Freeze freeze={freeze}>{children}</Freeze>;
}

FreezeWrapper.displayName = 'FreezeWrapper';

export default FreezeWrapper;
