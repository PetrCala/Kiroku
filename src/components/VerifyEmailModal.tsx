import {useEffect, useState} from 'react';
import {View} from 'react-native';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import * as Session from '@libs/actions/Session';
import {sleep} from '@libs/TimeUtils';
import * as User from '@userActions/User';
import CONST from '@src/CONST';
import Button from './Button';
import DotIndicatorMessage from './DotIndicatorMessage';
import Icon from './Icon';
import * as KirokuIcons from './Icon/KirokuIcons';
import Modal from './Modal';
import {PressableWithFeedback} from './Pressable';
import SafeAreaConsumer from './SafeAreaConsumer';
import SuccessAnimation from './SuccessAnimation';
import Text from './Text';

type ResendStatus = 'idle' | 'success' | 'error';

/**
 * Mandatory email-verification modal. Shown immediately after signup (and on
 * any subsequent sign-in if the email is still unverified) and stays in front
 * of the rest of the app until the user verifies — there is no defer/dismiss
 * affordance, because an unverified email is the exact state that triggers
 * Firebase's silent OAuth provider takeover (see PR #439 context). The only
 * way out without verifying is the tertiary "Sign out" link, which doesn't
 * compromise mandatory-ness: the modal reappears on the next sign-in.
 */
function VerifyEmailModal() {
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<ResendStatus>('idle');
  const [errorText, setErrorText] = useState('');

  // On mount, reload the user to pick up any verification that happened
  // out-of-band (e.g. user clicked the link in another tab/app before
  // returning here).
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

  const onVerifyButtonPress = () => {
    (async () => {
      if (!user) {
        return;
      }
      try {
        setErrorText('');
        setResendStatus('idle');
        setIsLoading(true);
        await user.reload();
        if (user.emailVerified) {
          setEmailVerified(true);
        } else {
          setErrorText(translate('verifyEmailScreen.error.emailNotVerified'));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '';
        setErrorText(
          errorMessage || translate('verifyEmailScreen.error.generic'),
        );
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const onResendButtonPress = () => {
    (async () => {
      try {
        setErrorText('');
        await User.sendVerifyEmailLink(user);
        setResendStatus('success');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '';
        setErrorText(
          errorMessage || translate('verifyEmailScreen.error.sending'),
        );
        setResendStatus('error');
      }
    })();
  };

  const onSignOutPress = () => {
    Session.signOut(auth).catch(error => {
      const errorMessage = error instanceof Error ? error.message : '';
      setErrorText(
        errorMessage || translate('verifyEmailScreen.error.generic'),
      );
    });
  };

  const onSuccessAnimationEnd = async () => {
    await sleep(1000).then(() => {
      setIsVisible(false);
    });
  };

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
                    {translate('verifyEmailScreen.title')}
                  </Text>
                  <Text textAlign="center" style={styles.mt3}>
                    {translate('verifyEmailScreen.body', {
                      email: user?.email ?? '',
                    })}
                  </Text>
                </View>
                <View style={styles.pb1}>
                  {resendStatus === 'success' && (
                    <DotIndicatorMessage
                      style={[styles.mv2]}
                      type="success"
                      messages={{
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        0: translate('verifyEmailScreen.emailSent'),
                      }}
                    />
                  )}
                  {!!errorText && (
                    <DotIndicatorMessage
                      style={[styles.mv2]}
                      type="error"
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      messages={{0: errorText}}
                    />
                  )}
                  <Button
                    success
                    large
                    isLoading={isLoading}
                    style={styles.mt1}
                    text={translate('verifyEmailScreen.iHaveVerified')}
                    onPress={onVerifyButtonPress}
                  />
                  <Button
                    large
                    style={styles.mt1}
                    text={translate('verifyEmailScreen.resendEmail')}
                    onPress={onResendButtonPress}
                  />
                  <PressableWithFeedback
                    style={[styles.mt4, styles.alignItemsCenter]}
                    onPress={onSignOutPress}
                    role={CONST.ROLE.BUTTON}
                    accessibilityLabel={translate('settingsScreen.signOut')}>
                    <Text style={styles.link}>
                      {translate('settingsScreen.signOut')}
                    </Text>
                  </PressableWithFeedback>
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
