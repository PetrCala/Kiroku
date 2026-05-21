import {useEffect, useState} from 'react';
import {View} from 'react-native';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import Log from '@libs/Log';
import * as Session from '@libs/actions/Session';
import {sleep} from '@libs/TimeUtils';
import * as UserUtils from '@libs/UserUtils';
import * as ValidationUtils from '@libs/ValidationUtils';
import * as User from '@userActions/User';
import CONFIG from '@src/CONFIG';
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
import TextInput from './TextInput';

type ResendStatus = 'idle' | 'success' | 'error';
type ModalView = 'verify' | 'changeEmail';

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

  // changeEmail sub-view state
  const [view, setView] = useState<ModalView>('verify');
  const [newEmailInput, setNewEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [changeEmailError, setChangeEmailError] = useState('');
  const [isChangeEmailLoading, setIsChangeEmailLoading] = useState(false);
  // Set to the new address after a successful email change so the verify
  // view body reflects the address we actually sent the link to.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

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

  // Non-production-only: lets QA skip past the modal without verifying.
  // Sets a module-level flag in UserUtils so the modal also doesn't re-mount
  // on subsequent sign-in cycles within the same app session. Cold restart
  // clears the flag and brings the modal back.
  const onDevSkipPress = () => {
    UserUtils.setDevBypassEmailVerification(true);
    setIsVisible(false);
    Log.info(
      '[VerifyEmailModal] dev-skip activated for this session',
      true,
      {},
      true,
    );
  };

  const onSuccessAnimationEnd = async () => {
    await sleep(1000).then(() => {
      setIsVisible(false);
    });
  };

  const onChangeEmailSubmit = () => {
    (async () => {
      setChangeEmailError('');
      const trimmedEmail = newEmailInput.trim();

      const emailError = ValidationUtils.validateEmail(
        trimmedEmail,
        user?.email,
      );
      if (emailError) {
        setChangeEmailError(translate(emailError));
        return;
      }
      if (!passwordInput) {
        setChangeEmailError(
          translate('verifyEmailScreen.changeEmail.error.passwordRequired'),
        );
        return;
      }

      setIsChangeEmailLoading(true);
      try {
        await User.sendUpdateEmailLink(user, trimmedEmail, passwordInput);
        setPendingEmail(trimmedEmail);
        setResendStatus('idle');
        setErrorText('');
        setNewEmailInput('');
        setPasswordInput('');
        setView('verify');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '';
        setChangeEmailError(
          errorMessage || translate('verifyEmailScreen.error.generic'),
        );
      } finally {
        setIsChangeEmailLoading(false);
      }
    })();
  };

  const displayEmail = pendingEmail ?? user?.email ?? '';

  const renderModalContent = () => {
    if (emailVerified) {
      return (
        <SuccessAnimation
          iconSource={KirokuIcons.Checkmark}
          text={translate('verifyEmailScreen.emailVerified')}
          visible
          onAnimationEnd={onSuccessAnimationEnd}
          style={styles.flexGrow1}
        />
      );
    }
    if (view === 'changeEmail') {
      return (
        <View style={styles.flex1}>
          <View style={[styles.flexGrow1, styles.justifyContentCenter]}>
            <Text
              textAlign="center"
              style={[styles.textHeadlineH2, styles.mb3]}>
              {translate('verifyEmailScreen.changeEmail.title')}
            </Text>
            <Text textAlign="center" style={styles.mb4}>
              {translate('verifyEmailScreen.changeEmail.prompt')}
            </Text>
            <TextInput
              label={translate('verifyEmailScreen.changeEmail.newEmailLabel')}
              accessibilityLabel={translate(
                'verifyEmailScreen.changeEmail.newEmailLabel',
              )}
              value={newEmailInput}
              onChangeText={text => {
                setNewEmailInput(text);
                setChangeEmailError('');
              }}
              inputMode={CONST.INPUT_MODE.EMAIL}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
            <TextInput
              label={translate('verifyEmailScreen.changeEmail.passwordLabel')}
              accessibilityLabel={translate(
                'verifyEmailScreen.changeEmail.passwordLabel',
              )}
              value={passwordInput}
              onChangeText={text => {
                setPasswordInput(text);
                setChangeEmailError('');
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              containerStyles={[styles.mt3]}
            />
            {!!changeEmailError && (
              <DotIndicatorMessage
                style={[styles.mv2]}
                type="error"
                // eslint-disable-next-line @typescript-eslint/naming-convention
                messages={{0: changeEmailError}}
              />
            )}
          </View>
          <View style={styles.pb1}>
            <Button
              success
              large
              isLoading={isChangeEmailLoading}
              style={styles.mt1}
              text={translate('verifyEmailScreen.changeEmail.submit')}
              onPress={onChangeEmailSubmit}
            />
            <PressableWithFeedback
              style={[styles.mt4, styles.alignItemsCenter]}
              onPress={() => {
                setChangeEmailError('');
                setView('verify');
              }}
              role={CONST.ROLE.BUTTON}
              accessibilityLabel={translate(
                'verifyEmailScreen.changeEmail.back',
              )}>
              <Text style={styles.link}>
                {translate('verifyEmailScreen.changeEmail.back')}
              </Text>
            </PressableWithFeedback>
          </View>
        </View>
      );
    }
    return (
      <View>
        <View
          style={[
            styles.flexGrow1,
            styles.justifyContentCenter,
            styles.alignItemsCenter,
          ]}>
          <Icon src={KirokuIcons.Mail} fill={theme.appColor} large />
          <Text textAlign="center" style={[styles.textHeadlineH2, styles.mt3]}>
            {translate('verifyEmailScreen.title')}
          </Text>
          <Text textAlign="center" style={styles.mt3}>
            {translate('verifyEmailScreen.body', {email: displayEmail})}
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
          {!!pendingEmail && resendStatus === 'idle' && (
            <DotIndicatorMessage
              style={[styles.mv2]}
              type="success"
              messages={{
                // eslint-disable-next-line @typescript-eslint/naming-convention
                0: translate('verifyEmailScreen.changeEmail.sent', {
                  email: pendingEmail,
                }),
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
            style={[styles.mt3, styles.alignItemsCenter]}
            onPress={() => setView('changeEmail')}
            role={CONST.ROLE.BUTTON}
            accessibilityLabel={translate(
              'verifyEmailScreen.useADifferentEmail',
            )}>
            <Text style={[styles.link, styles.textSupporting]}>
              {translate('verifyEmailScreen.useADifferentEmail')}
            </Text>
          </PressableWithFeedback>
          <PressableWithFeedback
            style={[styles.mt4, styles.alignItemsCenter]}
            onPress={onSignOutPress}
            role={CONST.ROLE.BUTTON}
            accessibilityLabel={translate('settingsScreen.signOut')}>
            <Text style={styles.link}>
              {translate('settingsScreen.signOut')}
            </Text>
          </PressableWithFeedback>
          {(CONFIG.IS_IN_DEVELOPMENT ||
            CONFIG.IS_IN_STAGING ||
            CONFIG.IS_IN_ADHOC) && (
            <PressableWithFeedback
              style={[styles.mt2, styles.alignItemsCenter]}
              onPress={onDevSkipPress}
              role={CONST.ROLE.BUTTON}
              accessibilityLabel="Skip verification (dev only)">
              <Text style={[styles.link, styles.textSupporting]}>
                Skip verification (dev only)
              </Text>
            </PressableWithFeedback>
          )}
        </View>
      </View>
    );
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
              styles.alignItemsCenter,
              // Match the bottom-padding pattern used by TermsScreenContent:
              // respect the device's safe area inset, and fall back to pb5
              // (not pb1) on devices where the inset is 0 so the buttons
              // don't sit flush against the screen edge.
              safeAreaPaddingBottomStyle.paddingBottom
                ? safeAreaPaddingBottomStyle
                : styles.pb5,
            ]}>
            {renderModalContent()}
          </View>
        </Modal>
      )}
    </SafeAreaConsumer>
  );
}

VerifyEmailModal.displayName = 'VerifyEmailModal';
export default VerifyEmailModal;
