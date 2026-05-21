import React, {useState} from 'react';
import {View} from 'react-native';
import Button from '@components/Button';
import DotIndicatorMessage from '@components/DotIndicatorMessage';
import Modal from '@components/Modal';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as User from '@userActions/User';
import CONST from '@src/CONST';

type ReauthPromptModalProps = {
  /** All currently linked providerIds (e.g. ['password', 'apple.com']). */
  linkedProviderIds: string[];
  /** Called after a successful reauth. The parent then retries the original action. */
  onReauthenticated: () => void | Promise<void>;
  /** Called when the user cancels (the parent should drop the queued retry). */
  onCancel: () => void;
};

/**
 * Prompts the user to confirm their identity before a sensitive Connected
 * Accounts mutation. Triggered by `auth/requires-recent-login`.
 *
 * - If password is among the linked providers, asks for the password and
 *   calls `reauthentificateUser`.
 * - Otherwise the account is OAuth-only; we re-run the OAuth flow for whichever
 *   provider is currently linked (preferring Apple, then Google) and call
 *   `reauthenticateWithCredential` via `reauthenticateWithOAuth`.
 *
 * On success calls `onReauthenticated`; on cancel calls `onCancel`. Errors are
 * surfaced inline; the modal stays open so the user can retry.
 */
function ReauthPromptModal({
  linkedProviderIds,
  onReauthenticated,
  onCancel,
}: ReauthPromptModalProps) {
  const {auth} = useFirebase();
  const {translate} = useLocalize();
  const styles = useThemeStyles();

  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');

  const user = auth.currentUser;
  const hasPassword = linkedProviderIds.includes(CONST.AUTH_PROVIDER.PASSWORD);
  // Pick a fallback OAuth provider to reauth with. Preference is arbitrary —
  // either would work; Apple first because it's the more common path on iOS.
  const oauthProviderId =
    !hasPassword &&
    linkedProviderIds.find(
      id =>
        id === CONST.AUTH_PROVIDER.APPLE || id === CONST.AUTH_PROVIDER.GOOGLE,
    );
  let oauthProviderName = '';
  if (oauthProviderId === CONST.AUTH_PROVIDER.APPLE) {
    oauthProviderName = translate('connectedAccounts.providers.apple');
  } else if (oauthProviderId === CONST.AUTH_PROVIDER.GOOGLE) {
    oauthProviderName = translate('connectedAccounts.providers.google');
  }

  const handleSubmitPassword = () => {
    (async () => {
      if (!user) {
        return;
      }
      setIsSubmitting(true);
      setErrorText('');
      try {
        const result = await User.reauthentificateUser(user, password);
        if (!result) {
          setErrorText(translate('connectedAccounts.reauth.error'));
          return;
        }
        await onReauthenticated();
      } catch (error) {
        setErrorText(ErrorUtils.getAppError(undefined, error).message);
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  const handleReauthOAuth = () => {
    (async () => {
      if (!user || !oauthProviderId) {
        return;
      }
      setIsSubmitting(true);
      setErrorText('');
      try {
        const result = await User.reauthenticateWithOAuth(
          user,
          oauthProviderId,
        );
        // null = user cancelled the native flow. Keep the modal open.
        if (!result) {
          return;
        }
        await onReauthenticated();
      } catch (error) {
        setErrorText(ErrorUtils.getAppError(undefined, error).message);
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  return (
    <Modal
      isVisible
      type={CONST.MODAL.MODAL_TYPE.CENTERED_UNSWIPEABLE}
      onClose={() => {
        if (!isSubmitting) {
          onCancel();
        }
      }}>
      <View style={[styles.p5]}>
        <Text style={[styles.textHeadlineH2, styles.mb3]}>
          {translate('connectedAccounts.reauth.title')}
        </Text>
        <Text style={styles.mb3}>
          {hasPassword
            ? translate('connectedAccounts.reauth.passwordPrompt')
            : translate('connectedAccounts.reauth.oauthPrompt', {
                provider: oauthProviderName,
              })}
        </Text>
        {hasPassword ? (
          <>
            <TextInput
              value={password}
              onChangeText={setPassword}
              label={translate('common.password')}
              accessibilityLabel={translate('common.password')}
              aria-label={translate('common.password')}
              secureTextEntry
              autoFocus
              editable={!isSubmitting}
            />
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
              isLoading={isSubmitting}
              isDisabled={!password}
              style={styles.mt4}
              text={translate('connectedAccounts.reauth.submit')}
              onPress={handleSubmitPassword}
            />
          </>
        ) : (
          <>
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
              isLoading={isSubmitting}
              style={styles.mt4}
              text={translate('connectedAccounts.reauth.reauthWith', {
                provider: oauthProviderName,
              })}
              onPress={handleReauthOAuth}
            />
          </>
        )}
        <Button
          large
          style={[styles.mt1, styles.bgTransparent]}
          textStyles={styles.textAppColor}
          text={translate('connectedAccounts.actions.cancel')}
          onPress={onCancel}
          isDisabled={isSubmitting}
        />
      </View>
    </Modal>
  );
}

ReauthPromptModal.displayName = 'ReauthPromptModal';

export default ReauthPromptModal;
