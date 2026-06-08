import useThemeStyles from '@hooks/useThemeStyles';
import useStyleUtils from '@hooks/useStyleUtils';
import {View} from 'react-native';
import variables from '@src/styles/variables';
import useLocalize from '@hooks/useLocalize';
import Text from './Text';

type NoSessionsInfoProps = {
  /** The message to display to the user */
  message?: string;

  /** The text to display on the button */
  buttonText?: string;
};

/** A View shown on the home screen when the user has no drinking sessions yet */
function NoSessionsInfo({message, buttonText}: NoSessionsInfoProps) {
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {translate} = useLocalize();

  return (
    <View
      style={[styles.fullScreenCenteredContent, styles.mnh100, styles.pb40]}>
      <Text
        style={[
          styles.loginHeroHeader,
          StyleUtils.getFontSizeStyle(variables.fontSizeSignInHeroXSmall),
        ]}>
        {buttonText ?? translate('homeScreen.welcomeToKiroku')}
      </Text>
      <Text style={styles.textHomeScreenNoSessions}>
        {message ?? translate('homeScreen.startNewSessionByClickingPlus')}
      </Text>
    </View>
  );
}

export default NoSessionsInfo;
