import useThemeStyles from '@hooks/useThemeStyles';
import * as User from '@userActions/User';
import {useEffect, useState} from 'react';
import {View} from 'react-native';
import useLocalize from '@hooks/useLocalize';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import useTheme from '@hooks/useTheme';
import {sleep} from '@libs/TimeUtils';
import {useFirebase} from '@context/global/FirebaseContext';
import CONST from '@src/CONST';
import Icon from './Icon';
import SuccessAnimation from './SuccessAnimation';
import Modal from './Modal';
import SafeAreaConsumer from './SafeAreaConsumer';
import DotIndicatorMessage from './DotIndicatorMessage';
import * as KirokuIcons from './Icon/KirokuIcons';
import Text from './Text';
import Button from './Button';

function VerifyEmailModal() {
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState(true);
  const [emailSent, setEmailSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const onVerifyEmailButtonPress = () => {
    (async () => {
      try {
        setErrorText('');
        setIsLoading(true);
        await User.sendVerifyEmailLink(user);
        setEmailSent(true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '';
        setErrorText(errorMessage);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const onChangeEmailButtonPress = () => {
    (async () => {
      if (!emailSent) {
        setIsVisible(false);
        Navigation.navigate(ROUTES.SETTINGS_EMAIL);
        return;
      }
      if (user) {
        await user.reload();
        setEmailVerified(user.emailVerified);
        if (!user.emailVerified) {
          setErrorText(translate('verifyEmailScreen.error.emailNotVerified'));
        }
      } else {
        setErrorText(translate('verifyEmailScreen.error.emailNotVerified'));
      }
    })();
  };

  const onDismissVerifyEmail = () => {
    const dismissTime = new Date().getTime();
    User.setVerifyEmailDismissed(dismissTime)
      .then(() => {
        setIsVisible(false);
      })
      .catch(error => {
        const errorMessage = error instanceof Error ? error.message : '';
        setErrorText(errorMessage);
      });
  };

  const onSuccessAnimationEnd = async () => {
    await sleep(1000).then(() => {
      setIsVisible(false);
    });
  };

  // Redirect to home screen if user is verified
  useEffect(() => {
    const checkStatus = async () => {
      if (!user) {
        return;
      }

      await user.reload();
      setEmailVerified(user.emailVerified);
    };
    checkStatus();
  }, [user, auth]);

  return (
    <SafeAreaConsumer>
      {({safeAreaPaddingBottomStyle}) => (
        <Modal
          isVisible={isVisible}
          type={CONST.MODAL.MODAL_TYPE.CENTERED_UNSWIPEABLE}
          onClose={() => {}}
          innerContainerStyle={{
            flex: 1,
            boxShadow: 'none',
          }}>
          <View
            style={[
              styles.flex1,
              styles.mh4,
              styles.pb1,
              styles.alignItemsCenter,
              safeAreaPaddingBottomStyle,
            ]}>
            {!emailVerified ? (
              <View>
                <View
                  style={[
                    styles.flexGrow1,
                    styles.justifyContentCenter,
                    styles.alignItemsCenter,
                  ]}>
                  <Icon src={KirokuIcons.Mail} fill={theme.appColor} large />
                  <Text
                    textAlign="center"
                    style={[styles.textHeadlineH2, styles.mt3]}>
                    {translate(
                      emailSent
                        ? 'verifyEmailScreen.oneMoreStep'
                        : 'verifyEmailScreen.youAreNotVerified',
                    )}
                  </Text>
                  <Text textAlign="center" style={styles.mt3}>
                    {emailSent
                      ? translate('verifyEmailScreen.checkYourInbox')
                      : translate('verifyEmailScreen.wouldYouLikeToVerify', {
                          email: user?.email ?? '',
                        })}
                  </Text>
                </View>
                <View style={styles.pb1}>
                  {!!emailSent && !errorText && (
                    <DotIndicatorMessage
                      style={[styles.mv2]}
                      type="success"
                      messages={{
                        // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/prefer-nullish-coalescing
                        0: translate('verifyEmailScreen.emailSent'),
                      }}
                    />
                  )}
                  {!!errorText && (
                    <DotIndicatorMessage
                      style={[styles.mv2]}
                      type="error"
                      // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/prefer-nullish-coalescing
                      messages={{0: errorText || ''}}
                    />
                  )}
                  <Button
                    success
                    isLoading={isLoading && !emailSent}
                    style={styles.mt1}
                    text={translate(
                      emailSent
                        ? 'verifyEmailScreen.iHaveVerified'
                        : 'verifyEmailScreen.verifyEmail',
                    )}
                    onPress={
                      emailSent
                        ? onChangeEmailButtonPress
                        : onVerifyEmailButtonPress
                    }
                    large
                  />
                  <Button
                    style={[styles.mt1]}
                    text={translate(
                      emailSent
                        ? 'verifyEmailScreen.resendEmail'
                        : 'verifyEmailScreen.changeEmail',
                    )}
                    onPress={
                      emailSent
                        ? onVerifyEmailButtonPress
                        : onChangeEmailButtonPress
                    }
                    large
                  />
                  <Button
                    text={translate('verifyEmailScreen.illDoItLater')}
                    style={styles.bgTransparent}
                    textStyles={styles.textAppColor}
                    onPress={onDismissVerifyEmail}
                    large
                  />
                </View>
              </View>
            ) : (
              <SuccessAnimation
                iconSource={KirokuIcons.Checkmark}
                text={translate('verifyEmailScreen.emailVerified')}
                visible
                onAnimationEnd={onSuccessAnimationEnd}
                style={styles.flexGrow1}
              />
            )}
          </View>
        </Modal>
      )}
    </SafeAreaConsumer>
  );
}

VerifyEmailModal.displayName = 'VerifyEmailModal';
export default VerifyEmailModal;
