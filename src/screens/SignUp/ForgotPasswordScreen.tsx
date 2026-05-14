import React, {useCallback} from 'react';
import {View} from 'react-native';
import {sendPasswordResetEmail} from 'firebase/auth';
import FullscreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as ValidationUtils from '@libs/ValidationUtils';
import * as ErrorUtils from '@libs/ErrorUtils';
import type {FormInputErrors, FormOnyxValues} from '@src/components/Form/types';
import ONYXKEYS from '@src/ONYXKEYS';
import INPUT_IDS from '@src/types/form/ForgotPasswordForm';
import FormProvider from '@components/Form/FormProvider';
import Text from '@components/Text';
import type {Errors} from '@src/types/onyx/OnyxCommon';
import InputWrapper from '@components/Form/InputWrapper';
import variables from '@src/styles/variables';
import TextInput from '@components/TextInput';
import {useFirebase} from '@context/global/FirebaseContext';
import ROUTES from '@src/ROUTES';
import DotIndicatorMessage from '@components/DotIndicatorMessage';

function ForgotPasswordScreen() {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {auth} = useFirebase();
  const [serverErrorMessage, setServerErrorMessage] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const onSubmit = (
    values: FormOnyxValues<typeof ONYXKEYS.FORMS.FORGOT_PASSWORD_FORM>,
  ) => {
    (async () => {
      setIsLoading(true);
      setSuccessMessage('');

      try {
        const emailToSend = values.email.trim();
        await sendPasswordResetEmail(auth, emailToSend);
        setSuccessMessage(
          translate('forgotPasswordScreen.success', {email: emailToSend}),
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
    (
      values: FormOnyxValues<typeof ONYXKEYS.FORMS.FORGOT_PASSWORD_FORM>,
    ): Errors => {
      const errors: FormInputErrors<
        typeof ONYXKEYS.FORMS.FORGOT_PASSWORD_FORM
      > = {};

      setServerErrorMessage('');

      const emailErrorTranslationKey = ValidationUtils.validateEmail(
        values.email,
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
    [translate],
  );

  return (
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
      testID={ForgotPasswordScreen.displayName}>
      <HeaderWithBackButton
        title={translate('forgotPasswordScreen.title')}
        shouldShowBackButton
        onBackButtonPress={() => Navigation.navigate(ROUTES.AUTH)}
      />
      {isLoading ? (
        <FullscreenLoadingIndicator
          style={[styles.flex1]}
          loadingText={translate('forgotPasswordScreen.sending')}
        />
      ) : (
        <FormProvider
          formID={ONYXKEYS.FORMS.FORGOT_PASSWORD_FORM}
          validate={validate}
          onSubmit={onSubmit}
          submitButtonText={translate('forgotPasswordScreen.submit')}
          isSubmitDisabled={!!successMessage}
          style={[styles.flexGrow1, styles.mh5]}>
          <View style={[styles.flexGrow1]}>
            <Text>{translate('forgotPasswordScreen.prompt')}</Text>
            <InputWrapper
              InputComponent={TextInput}
              inputID={INPUT_IDS.EMAIL}
              name="email"
              shouldShowClearButton
              shouldSaveDraft
              maxAutoGrowHeight={variables.textInputAutoGrowMaxHeight}
              label={translate('forgotPasswordScreen.enterEmail')}
              aria-label={translate('forgotPasswordScreen.enterEmail')}
              defaultValue=""
              spellCheck={false}
              containerStyles={[styles.mt5]}
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

ForgotPasswordScreen.displayName = 'ForgotPasswordScreen';

export default ForgotPasswordScreen;
