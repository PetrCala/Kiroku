/* eslint-disable react/no-array-index-key */
import React from 'react';
import type {StyleProp, TextStyle, ViewStyle} from 'react-native';
import {View} from 'react-native';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import Icon from './Icon';
import * as KirokuIcons from './Icon/KirokuIcons';
import Text from './Text';

type DotIndicatorMessageProps = {
  /**
   * In most cases this should just be errors from onxyData
   * if you are not passing that data then this needs to be in a similar shape like
   *  {
   *      timestamp: 'message',
   *  }
   */
  messages: Record<string, string | null>;

  /** The type of message, 'error' shows a red dot, 'success' shows a green dot */
  type: 'error' | 'success';

  /** Additional styles to apply to the container */
  style?: StyleProp<ViewStyle>;

  /** Additional styles to apply to the text */
  textStyles?: StyleProp<TextStyle>;
};

function DotIndicatorMessage({
  messages = {},
  style,
  type,
  textStyles,
}: DotIndicatorMessageProps) {
  const theme = useTheme();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();

  if (Object.keys(messages).length === 0) {
    return null;
  }

  // Fetch the keys, sort them, and map through each key to get the corresponding message
  const sortedMessages: Array<string> = Object.keys(messages)
    .sort()
    .map(key => messages[key])
    .filter((message): message is string => message !== null);
  // Removing duplicates using Set and transforming the result into an array
  const uniqueMessages: Array<string> = [...new Set(sortedMessages)].map(
    message => message,
  );

  const isErrorMessage = type === 'error';

  return (
    <View style={[styles.dotIndicatorMessage, style]}>
      <View style={styles.offlineFeedback.errorDot}>
        <Icon
          src={KirokuIcons.DotIndicator}
          fill={isErrorMessage ? theme.danger : theme.success}
        />
      </View>
      <View style={styles.offlineFeedback.textContainer}>
        {uniqueMessages.map((message, i) => (
          <Text
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            style={[
              StyleUtils.getDotIndicatorTextStyles(isErrorMessage),
              textStyles,
            ]}>
            {message}
          </Text>
        ))}
      </View>
    </View>
  );
}

DotIndicatorMessage.displayName = 'DotIndicatorMessage';

export default DotIndicatorMessage;
