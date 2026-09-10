import React from 'react';
import {Linking, View} from 'react-native';
import Button from '@components/Button';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';

/**
 * App download buttons under a signed-out invite preview. Web only: someone
 * who opened an invite link in the browser may not have the app yet. The
 * native build renders nothing (see `index.native.tsx`).
 */
function InviteAppDownloadButtons() {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  return (
    <View style={[styles.w100, styles.mt8]}>
      <Text style={[styles.textLabelSupporting, styles.textAlignCenter]}>
        {translate('addFriendScreen.getTheApp')}
      </Text>
      <Button
        text={translate('addFriendScreen.getIosApp')}
        onPress={() => {
          Linking.openURL(CONST.STORE_LINKS.IOS);
        }}
        style={[styles.w100, styles.mt3]}
      />
      <Button
        text={translate('addFriendScreen.getAndroidApp')}
        onPress={() => {
          Linking.openURL(CONST.STORE_LINKS.ANDROID);
        }}
        style={[styles.w100, styles.mt3]}
      />
    </View>
  );
}

InviteAppDownloadButtons.displayName = 'InviteAppDownloadButtons';
export default InviteAppDownloadButtons;
