import React, {useCallback, useEffect} from 'react';
import {View} from 'react-native';
import FullscreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as ValidationUtils from '@libs/ValidationUtils';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as User from '@userActions/User';
import * as Session from '@userActions/Session';
import type {SettingsNavigatorParamList} from '@libs/Navigation/types';
import type {FormInputErrors, FormOnyxValues} from '@src/components/Form/types';
import ONYXKEYS from '@src/ONYXKEYS';
import INPUT_IDS from '@src/types/form/EmailForm';
import FormProvider from '@components/Form/FormProvider';
import Text from '@components/Text';
import type {Errors} from '@src/types/onyx/OnyxCommon';
import InputWrapper from '@components/Form/InputWrapper';
import variables from '@src/styles/variables';
import CONST from '@src/CONST';
import TextInput from '@components/TextInput';
import type {StackScreenProps} from '@react-navigation/stack';
import type SCREENS from '@src/SCREENS';
import {useFirebase} from '@context/global/FirebaseContext';
import DotIndicatorMessage from '@components/DotIndicatorMessage';

type EmailScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.ACCOUNT.EMAIL
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function EmailScreen({route}: EmailScreenProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const currentEmail = auth.currentUser?.email;
  const [serverErrorMessage, setServerErrorMessage] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const onSubmit = (
    values: FormOnyxValues<typeof ONYXKEYS.FORMS.EMAIL_FORM>,
  ) => {
    (async () => {
      setIsLoading(true);
      setSuccessMessage('');

      try {
        const emailToSend = values.email.trim();
        const password = values.password;

        await User.sendUpdateEmailLink(auth.currentUser, emailToSend, password);
        setSuccessMessage(
          translate('emailScreen.success', {email: emailToSend}),
        );
      } catch (error) {
        const appError = ErrorUtils.getAppError(undefined, error);
        setServerErrorMessage(appError.message);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const validate = useCallback(
    (values: FormOnyxValues<typeof ONYXKEYS.FORMS.EMAIL_FORM>): Errors => {
      setServerErrorMessage('');

      const errors: FormInputErrors<typeof ONYXKEYS.FORMS.EMAIL_FORM> =
        ValidationUtils.getFieldRequiredErrors(values, ['email', 'password']);

      const emailErrorTranslationKey = ValidationUtils.validateEmail(
        values.email,
        currentEmail,
      );

      if (emailErrorTranslationKey) {
        ErrorUtils.addErrorMessage(
          errors,
          INPUT_IDS.EMAIL,
          translate(emailErrorTranslationKey),
        );
      }

      return errors;
    },
    [translate, currentEmail],
  );

  useEffect(() => {
    const signOut = async () => {
      await Session.signOut(auth);
    };
    if (!user) {
      signOut();
    }
  }, [user, auth]);

  return (
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
      shouldShowOfflineIndicator={false}
      testID={EmailScreen.displayName}>
      <HeaderWithBackButton
        title={translate('emailScreen.title')}
        shouldShowBackButton
        onBackButtonPress={Navigation.goBack}
      />
      {isLoading ? (
        <FullscreenLoadingIndicator
          style={[styles.flex1]}
          loadingText={translate('emailScreen.sending')}
        />
      ) : (
        <FormProvider
          formID={ONYXKEYS.FORMS.EMAIL_FORM}
          validate={validate}
          onSubmit={onSubmit}
          submitButtonText={translate('emailScreen.submit')}
          isSubmitDisabled={!!successMessage}
          style={[styles.flexGrow1, styles.mh5]}>
          <View style={[styles.flexGrow1]}>
            <Text style={styles.mb3}>{translate('emailScreen.prompt')}</Text>
            <Text style={[styles.mutedTextLabel]}>
              {translate('emailScreen.note')}
            </Text>
            <InputWrapper
              InputComponent={TextInput}
              inputID={INPUT_IDS.EMAIL}
              name="email"
              autoGrowHeight
              maxAutoGrowHeight={variables.textInputAutoGrowMaxHeight}
              label={translate('emailScreen.enterEmail')}
              aria-label={translate('emailScreen.enterEmail')}
              shouldSaveDraft
              defaultValue={currentEmail ?? ''}
              spellCheck={false}
              containerStyles={[styles.mt4]}
            />
            <Text style={[styles.mt6]}>
              {translate('emailScreen.enterPasswordToConfirm')}
            </Text>
            <InputWrapper
              InputComponent={TextInput}
              inputID={INPUT_IDS.PASSWORD}
              autoCapitalize="none"
              label={translate('emailScreen.enterPassword')}
              aria-label={translate('emailScreen.enterPassword')}
              role={CONST.ROLE.PRESENTATION}
              containerStyles={[styles.mt4]}
              autoCorrect={false}
              inputMode={CONST.INPUT_MODE.TEXT}
              secureTextEntry
            />
            {!!serverErrorMessage && (
              <DotIndicatorMessage
                style={[styles.mv2]}
                type="error"
                // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/prefer-nullish-coalescing
                messages={{0: serverErrorMessage || ''}}
              />
            )}
            {!!successMessage && (
              <DotIndicatorMessage
                style={[styles.mv2]}
                type="success"
                // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/prefer-nullish-coalescing
                messages={{0: successMessage || ''}}
              />
            )}
          </View>
        </FormProvider>
      )}
    </ScreenWrapper>
  );
}

EmailScreen.displayName = 'EmailScreen';

export default EmailScreen;
