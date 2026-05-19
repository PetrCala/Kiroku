import {sendPasswordResetEmail} from 'firebase/auth';
import React, {useState} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as User from '@userActions/User';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PendingOAuthCredential} from '@src/types/onyx';
import Button from './Button';
import DotIndicatorMessage from './DotIndicatorMessage';
import Modal from './Modal';
import {PressableWithFeedback} from './Pressable';
import Text from './Text';
import TextInput from './TextInput';

type OAuthLinkModalContentProps = {
  pending: PendingOAuthCredential;
};

/**
 * Inner content of the OAuth link modal. Owns the transient form state.
 * Always rendered with a fresh instance per collision (parent supplies a
 * `key` that changes), so state never carries over between sessions.
 */
function OAuthLinkModalContent({pending}: OAuthLinkModalContentProps) {
  const {auth} = useFirebase();
  const {translate} = useLocalize();
  const styles = useThemeStyles();

  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const isApple = pending.providerId === 'apple.com';
  const title = translate(
    isApple ? 'oauthLinkModal.appleTitle' : 'oauthLinkModal.googleTitle',
  );
  const submitText = translate(
    isApple ? 'oauthLinkModal.appleSubmit' : 'oauthLinkModal.googleSubmit',
  );
  const passwordLabel = translate('common.password');

  const handleCancel = () => {
    if (isLoading) {
      return;
    }
    User.clearPendingOAuthCredential();
  };

  const handleSubmit = () => {
    (async () => {
      setIsLoading(true);
      setErrorText('');
      try {
        await User.linkPendingOAuthCredential(auth, password, pending);
        // Success: action cleared the stash; Onyx subscription will unmount us.
      } catch (error) {
        const appError = ErrorUtils.getAppError(undefined, error);
        setErrorText(appError.message);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const handleForgotPassword = () => {
    (async () => {
      setErrorText('');
      try {
        await sendPasswordResetEmail(auth, pending.email);
        setResetEmailSent(true);
      } catch (error) {
        const appError = ErrorUtils.getAppError(undefined, error);
        setErrorText(appError.message);
      }
    })();
  };

  return (
    <Modal
      isVisible
      type={CONST.MODAL.MODAL_TYPE.CENTERED_UNSWIPEABLE}
      onClose={handleCancel}>
      <View style={[styles.p5]}>
        <Text style={[styles.textHeadlineH2, styles.mb3]}>{title}</Text>
        <Text style={styles.mb3}>
          {translate('oauthLinkModal.body', {email: pending.email})}
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          label={passwordLabel}
          accessibilityLabel={passwordLabel}
          aria-label={passwordLabel}
          secureTextEntry
          autoFocus
          editable={!isLoading}
        />
        {!!errorText && (
          <DotIndicatorMessage
            style={[styles.mv2]}
            type="error"
            // eslint-disable-next-line @typescript-eslint/naming-convention
            messages={{0: errorText}}
          />
        )}
        {!!resetEmailSent && (
          <DotIndicatorMessage
            style={[styles.mv2]}
            type="success"
            messages={{
              // eslint-disable-next-line @typescript-eslint/naming-convention
              0: translate('oauthLinkModal.resetEmailSent', {
                email: pending.email,
              }),
            }}
          />
        )}
        {!resetEmailSent && (
          <PressableWithFeedback
            style={[styles.link, styles.mt3]}
            onPress={handleForgotPassword}
            disabled={isLoading}
            role={CONST.ROLE.BUTTON}
            accessibilityLabel={translate('password.forgot')}>
            <Text style={styles.link}>{translate('password.forgot')}</Text>
          </PressableWithFeedback>
        )}
        <Button
          success
          large
          isLoading={isLoading}
          isDisabled={!password}
          style={styles.mt4}
          text={submitText}
          onPress={handleSubmit}
        />
        <Button
          large
          style={[styles.mt1, styles.bgTransparent]}
          textStyles={styles.textAppColor}
          text={translate('common.cancel')}
          onPress={handleCancel}
          isDisabled={isLoading}
        />
      </View>
    </Modal>
  );
}

/**
 * Collision-resolution modal for OAuth sign-in.
 *
 * Appears whenever `ONYXKEYS.PENDING_OAUTH_CREDENTIAL` is set — i.e. when an
 * Apple/Google sign-in collided with an existing email/password account and
 * the SignInButton stashed the pending credential. Prompts the user for the
 * existing account's password, then calls `linkPendingOAuthCredential` to
 * attach the OAuth provider so both methods sign into the same Firebase user.
 *
 * The keyed inner component guarantees that a new collision starts with a
 * fresh, empty form regardless of what the previous session left behind.
 *
 * Post-link routing (onboarding, terms, etc.) is owned by OnboardingGuard;
 * this modal does not navigate.
 */
function OAuthLinkModal() {
  const [pending] = useOnyx(ONYXKEYS.PENDING_OAUTH_CREDENTIAL);

  if (!pending) {
    return null;
  }

  return (
    <OAuthLinkModalContent
      key={`${pending.providerId}:${pending.email}`}
      pending={pending}
    />
  );
}

OAuthLinkModal.displayName = 'OAuthLinkModal';
export default OAuthLinkModal;
