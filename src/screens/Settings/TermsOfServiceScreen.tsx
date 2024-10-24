import {Linking, View} from 'react-native';
import {WebView} from 'react-native-webview';
import Navigation from '@libs/Navigation/Navigation';
import ScreenWrapper from '@components/ScreenWrapper';
import getPlatform from '@libs/getPlatform';
import CONST from '@src/CONST';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import {useState} from 'react';
import useThemeStyles from '@hooks/useThemeStyles';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';

function TermsOfServiceScreen() {
  const styles = useThemeStyles();
  const [isLoading, setIsLoading] = useState(false);

  const termsHtml =
    getPlatform() === CONST.PLATFORM.ANDROID
      ? {uri: 'file:///android_asset/html/terms-of-service.html'}
      : require('@assets/html/terms-of-service.html');

  const handleStartLoadWithRequest = (request: any) => {
    // Check if the URL has "mailto:" scheme
    if (request.url.startsWith('mailto:')) {
      // Use Linking to open the default email client
      Linking.openURL(request.url);
      return false; // Returning false prevents WebView from trying to handle the URL
    }
    return true;
  };

  return (
    <ScreenWrapper testID={TermsOfServiceScreen.displayName}>
      <HeaderWithBackButton onBackButtonPress={Navigation.goBack} />
      {isLoading ? (
        <FullScreenLoadingIndicator />
      ) : (
        <View style={[styles.flex1, styles.appContent]}>
          <WebView
            originWhitelist={['*']}
            source={termsHtml}
            onShouldStartLoadWithRequest={handleStartLoadWithRequest}
            style={{flex: 1}}
            onLoadEnd={() => setIsLoading(false)}
            javaScriptEnabled
          />
        </View>
      )}
    </ScreenWrapper>
  );
}

TermsOfServiceScreen.displayName = 'Terms Of Service Screen';
export default TermsOfServiceScreen;
