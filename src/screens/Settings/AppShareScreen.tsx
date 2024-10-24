import ScreenWrapper from '@components/ScreenWrapper';
import Navigation from '@libs/Navigation/Navigation';
import type {SettingsNavigatorParamList} from '@libs/Navigation/types';
import type {StackScreenProps} from '@react-navigation/stack';
import type SCREENS from '@src/SCREENS';
import commonStyles from '@src/styles/commonStyles';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import {
  Alert,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import CONST from '@src/CONST';
import {copyToClipboard} from '@libs/StringUtilsKiroku';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import useTheme from '@hooks/useTheme';

type AppShareScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.APP_SHARE
>;

function AppShareScreen({route}: AppShareScreenProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();

  const handleCopyLinkPress = () => {
    try {
      copyToClipboard(CONST.APP_DOWNLOAD_LINK, true);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScreenWrapper testID={AppShareScreen.displayName}>
      <HeaderWithBackButton
        title={translate('appShareScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <View style={[styles.appContent]}>
        <View
          style={[
            localStyles.centeringContainer,
            localStyles.headingContainer,
          ]}>
          <Text style={[localStyles.mainText, styles.textPlainColor]}>
            Help us by sharing the app
          </Text>
        </View>
        <View style={[localStyles.centeringContainer, {height: '15%'}]}>
          <View
            style={[
              localStyles.centeringContainer,
              {height: '20%', flexDirection: 'row'},
            ]}>
            <Text style={[localStyles.mainText, styles.textPlainColor]}>
              either through a link
            </Text>
          </View>
          <View style={[localStyles.centeringContainer, {height: '80%'}]}>
            <TouchableOpacity
              accessibilityRole="button"
              style={localStyles.linkCopyButton}
              onPress={handleCopyLinkPress}>
              <Text style={localStyles.shareLinkText}>
                Copy share link to clipboard
              </Text>
              <Image
                source={KirokuIcons.Copy}
                style={[localStyles.linkCopyImage, {tintColor: theme.icon}]}
              />
            </TouchableOpacity>
          </View>
        </View>
        <View style={commonStyles.horizontalLine} />
        <View style={localStyles.qrCodeItemsContainer}>
          <View style={[localStyles.centeringContainer, {height: '15%'}]}>
            <Text style={[localStyles.mainText, styles.textPlainColor]}>
              or through a QR code
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => Linking.openURL(CONST.APP_QR_CODE_LINK)}
            style={[localStyles.centeringContainer, {height: 'auto'}]}>
            <Image
              source={KirokuIcons.QrCodeWithLogo}
              style={localStyles.qrCode}
            />
          </TouchableOpacity>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const localStyles = StyleSheet.create({
  centeringContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headingContainer: {
    height: '10%',
    marginBottom: '5%',
  },
  itemsContainer: {
    height: '90%',
  },
  horizontalLineContainer: {
    height: '2%',
    width: '100%',
    marginTop: 0,
  },
  qrCodeItemsContainer: {
    width: '100%',
    height: '70%',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  mainText: {
    fontSize: 17,
  },
  linkCopyButton: {
    width: 'auto',
    height: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  shareLinkText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'blue',
  },
  linkCopyImage: {
    marginLeft: 10,
    tintColor: 'black',
    width: 25,
    height: 25,
  },
  qrCode: {
    width: 200,
    height: 200,
  },
  copyQrCodeButton: {
    height: 'auto',
    width: 'auto',
    padding: 15,
  },
  copyQrCodeImage: {
    tintColor: 'black',
    width: 30,
    height: 30,
  },
});

AppShareScreen.displayName = 'App Share Screen';
export default AppShareScreen;
