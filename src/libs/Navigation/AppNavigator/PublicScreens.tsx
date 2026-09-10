// The current AuthScreens.tsx
import {createStackNavigator} from '@react-navigation/stack';
import React from 'react';
import type {PublicScreensParamList} from '@navigation/types';
import ForceUpdateScreen from '@components/Modals/ForceUpdateModal';
import AuthScreen from '@screens/SignUp/AuthScreen';
import InitialScreen from '@screens/SignUp/InitialScreen';
import ForgotPasswordScreen from '@screens/SignUp/ForgotPasswordScreen';
import AddFriendScreen from '@screens/Social/AddFriendScreen';
import NAVIGATORS from '@src/NAVIGATORS';
import SCREENS from '@src/SCREENS';
import defaultScreenOptions from './defaultScreenOptions';

const RootStack = createStackNavigator<PublicScreensParamList>();

function PublicScreens() {
  return (
    <RootStack.Navigator>
      {/* The structure for the HOME route has to be the same in public and auth screens. That's why the name for SignUpScreen is BOTTOM_TAB_NAVIGATOR. */}
      <RootStack.Screen
        name={NAVIGATORS.BOTTOM_TAB_NAVIGATOR}
        options={defaultScreenOptions}
        component={InitialScreen}
      />
      <RootStack.Screen
        name={SCREENS.AUTH}
        options={defaultScreenOptions}
        component={AuthScreen}
      />
      <RootStack.Screen
        name={SCREENS.FORGOT_PASSWORD}
        options={defaultScreenOptions}
        component={ForgotPasswordScreen}
      />
      <RootStack.Screen
        name={SCREENS.FORCE_UPDATE}
        options={{...defaultScreenOptions, gestureEnabled: false}}
        component={ForceUpdateScreen}
      />
      {/* Invite links opened while signed out: preview + sign-in (the code is
          kept and reopened after sign-in by PendingFriendInviteGuard). */}
      <RootStack.Screen
        name={SCREENS.ADD_FRIEND}
        options={defaultScreenOptions}
        component={AddFriendScreen}
      />
    </RootStack.Navigator>
  );
}

PublicScreens.displayName = 'PublicScreens';

export default PublicScreens;
