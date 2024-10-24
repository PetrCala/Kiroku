import useThemeStyles from '@hooks/useThemeStyles';
import {View, Text} from 'react-native';
import ScreenWrapper from './ScreenWrapper';

const UserOffline = () => {
  const styles = useThemeStyles();
  return (
    <ScreenWrapper
      style={[styles.w100, styles.pb0]}
      includePaddingTop={true}
      includeSafeAreaPaddingBottom={false}
      testID={'UserOfferline'}>
      <View
        style={[
          styles.flex1,
          styles.justifyContentCenter,
          styles.alignItemsCenter,
          styles.appContent,
          styles.mb10,
        ]}>
        <Text
          style={[
            styles.textAlignCenter,
            styles.textXXXLarge,
            styles.textPlainColor,
          ]}>
          You are offline
        </Text>
        <Text
          style={[
            styles.textAlignCenter,
            styles.textLarge,
            styles.p5,
            styles.textPlainColor,
          ]}>
          Unfortunately, Kiroku does not support offline mode yet. We appreciate
          your patience while we work on this feature.
        </Text>
      </View>
    </ScreenWrapper>
  );
};

export default UserOffline;
