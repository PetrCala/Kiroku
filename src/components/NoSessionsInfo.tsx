import useThemeStyles from '@hooks/useThemeStyles';
import useStyleUtils from '@hooks/useStyleUtils';
import {View} from 'react-native';
import variables from '@src/styles/variables';
import useLocalize from '@hooks/useLocalize';
import Text from './Text';

type NoSessionsInfoProps = {
  /** The message to display to the user */
  message?: string;

  /** The heading to display above the message */
  title?: string;
};

/**
 * A centered hero View shown on the home screen for the no-content states:
 * the default welcome ("no sessions yet"), or, with `title`/`message` overrides,
 * the offline "can't load your sessions" notice.
 */
function NoSessionsInfo({message, title}: NoSessionsInfoProps) {
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
        {title ?? translate('homeScreen.welcomeToKiroku')}
      </Text>
      <Text style={styles.textHomeScreenNoSessions}>
        {message ?? translate('homeScreen.startNewSessionByClickingPlus')}
      </Text>
    </View>
  );
}

export default NoSessionsInfo;
