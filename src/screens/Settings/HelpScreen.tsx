import {Linking, View} from 'react-native';
import {WebView} from 'react-native-webview';
import Navigation from '@libs/Navigation/Navigation';
import ScreenWrapper from '@components/ScreenWrapper';
import CONST from '@src/CONST';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import {useState} from 'react';
import useThemeStyles from '@hooks/useThemeStyles';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import {useUserConnection} from '@context/global/UserConnectionContext';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import useLocalize from '@hooks/useLocalize';
import type WebViewRequest from '@libs/WebView/types';

function HelpScreen() {
  const styles = useThemeStyles();
  const {isOnline} = useUserConnection();
  const {translate} = useLocalize();
  const loadingText = translate('settingsScreen.helpScreen.loading');
  const [isLoading, setIsLoading] = useState(false);

  const handleStartLoadWithRequest = (request: WebViewRequest) => {
    // Check if the URL has "mailto:" scheme
    if (request.url.startsWith('mailto:')) {
      // Use Linking to open the default email client
      Linking.openURL(request.url);
      return false; // Returning false prevents WebView from trying to handle the URL
    }
    return true;
  };

  return (
    <ScreenWrapper testID={HelpScreen.displayName}>
      <HeaderWithBackButton
        title={translate('settingsScreen.help')}
        onBackButtonPress={Navigation.goBack}
      />
      {isLoading ? (
        <FullScreenLoadingIndicator loadingText={loadingText} />
      ) : (
        <View style={[styles.flex1, styles.appContent]}>
          {!isOnline ? (
            <FlexibleLoadingIndicator text={loadingText} />
          ) : (
            <WebView
              originWhitelist={['*']}
              source={{uri: CONST.SUPPORT_URL}}
              onShouldStartLoadWithRequest={handleStartLoadWithRequest}
              style={styles.flex1}
              onLoadEnd={() => setIsLoading(false)}
              javaScriptEnabled
            />
          )}
        </View>
      )}
    </ScreenWrapper>
  );
}

HelpScreen.displayName = 'Help Screen';
export default HelpScreen;
