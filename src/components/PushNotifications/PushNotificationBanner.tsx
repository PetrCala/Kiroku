import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated, {FadeInUp, FadeOutUp} from 'react-native-reanimated';
import {PressableWithFeedback} from '@components/Pressable';
import Text from '@components/Text';
import useSafeAreaInsets from '@hooks/useSafeAreaInsets';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import PushNotification from '@libs/Notification/PushNotification';
import type {PushNotificationMessage} from '@libs/Notification/PushNotification/types';
import * as PushNotificationActions from '@userActions/PushNotification';
import CONST from '@src/CONST';

/** How long a foreground banner stays up before hiding itself. */
const BANNER_DURATION_MS = 5000;

/** Gap between the banner and the top safe-area edge. */
const BANNER_TOP_OFFSET = 8;

const localStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  banner: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
});

/**
 * In-app banner for pushes that arrive while the app is open. The system
 * shows nothing in the foreground, so without this the user would miss them.
 * Tapping opens the notification's deep link; it hides itself after a few
 * seconds. A newer push replaces the one on screen.
 */
function PushNotificationBanner() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<PushNotificationMessage | null>(null);

  useEffect(() => PushNotification.onForegroundMessage(setMessage), []);

  useEffect(() => {
    if (!message) {
      return undefined;
    }
    const timer = setTimeout(() => setMessage(null), BANNER_DURATION_MS);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message || (!message.title && !message.body)) {
    return null;
  }

  const onPress = () => {
    setMessage(null);
    PushNotificationActions.openNotification(message);
  };

  return (
    <Animated.View
      entering={FadeInUp}
      exiting={FadeOutUp}
      pointerEvents="box-none"
      style={[localStyles.container, {top: insets.top + BANNER_TOP_OFFSET}]}>
      <PressableWithFeedback
        onPress={onPress}
        role={CONST.ROLE.BUTTON}
        accessibilityLabel={[message.title, message.body]
          .filter(Boolean)
          .join('. ')}
        style={[
          localStyles.banner,
          {
            backgroundColor: theme.cardBG,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}>
        <View>
          {!!message.title && (
            <Text style={[styles.textNormal, styles.textStrong]}>
              {message.title}
            </Text>
          )}
          {!!message.body && (
            <Text style={[styles.textNormal, styles.mt1]} numberOfLines={3}>
              {message.body}
            </Text>
          )}
        </View>
      </PressableWithFeedback>
    </Animated.View>
  );
}

PushNotificationBanner.displayName = 'PushNotificationBanner';

export default PushNotificationBanner;
