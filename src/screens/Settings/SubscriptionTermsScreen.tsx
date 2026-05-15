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

function SubscriptionTermsScreen() {
  const styles = useThemeStyles();
  const {isOnline} = useUserConnection();
  const {translate} = useLocalize();
  const loadingText = translate(
    'settingsScreen.subscriptionTermsScreen.loading',
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleStartLoadWithRequest = (request: WebViewRequest) => {
    if (request.url.startsWith('mailto:')) {
      Linking.openURL(request.url);
      return false;
    }
    return true;
  };

  return (
    <ScreenWrapper testID={SubscriptionTermsScreen.displayName}>
      <HeaderWithBackButton onBackButtonPress={Navigation.goBack} />
      {isLoading ? (
        <FullScreenLoadingIndicator loadingText={loadingText} />
      ) : (
        <View style={[styles.flex1, styles.appContent]}>
          {!isOnline ? (
            <FlexibleLoadingIndicator text={loadingText} />
          ) : (
            <WebView
              originWhitelist={['*']}
              source={{uri: CONST.SUBSCRIPTION_TERMS_URL}}
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

SubscriptionTermsScreen.displayName = 'Subscription Terms Screen';
export default SubscriptionTermsScreen;
