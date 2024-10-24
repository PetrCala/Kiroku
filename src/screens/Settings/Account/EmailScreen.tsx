import React, {useCallback} from 'react';
import {Alert, View} from 'react-native';
import FullscreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as ValidationUtils from '@libs/ValidationUtils';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as User from '@database/users';
import type {SettingsNavigatorParamList} from '@libs/Navigation/types';
import type {FormInputErrors, FormOnyxValues} from '@src/components/Form/types';
import ONYXKEYS from '@src/ONYXKEYS';
import INPUT_IDS from '@src/types/form/EmailForm';
import FormProvider from '@components/Form/FormProvider';
import Text from '@components/Text';
import {Errors} from '@src/types/onyx/OnyxCommon';
import InputWrapper from '@components/Form/InputWrapper';
import variables from '@src/styles/variables';
import CONST from '@src/CONST';
import TextInput from '@components/TextInput';
import {StackScreenProps} from '@react-navigation/stack';
import SCREENS from '@src/SCREENS';
// import {submitEmail} from '@database/feedback';
import {useFirebase} from '@context/global/FirebaseContext';
import {applyActionCode, verifyBeforeUpdateEmail} from 'firebase/auth';

type EmailScreenOnyxProps = {};

type EmailScreenProps = EmailScreenOnyxProps &
  StackScreenProps<
    SettingsNavigatorParamList,
    typeof SCREENS.SETTINGS.ACCOUNT.EMAIL
  >;

function EmailScreen({}: EmailScreenProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {db, auth} = useFirebase();
  const currentEmail = auth.currentUser?.email;

  const [isLoading, setIsLoading] = React.useState(false);

  const onSubmit = async (
    values: FormOnyxValues<typeof ONYXKEYS.FORMS.EMAIL_FORM>,
  ) => {
    // applyActionCode
    try {
      // TODO finish this
      console.log('Submitting email...');
      // await User.sendUpdateEmailLink(auth.currentUser, values.email);
    } catch (error: any) {
      ErrorUtils.raiseAlert(error, translate('emailScreen.error.generic'));
    } finally {
      console.debug('Navigating to email verification screen...');
      // Navigation.navigate(ROUTES.SETTINGS.ACCOUNT.EMAIL_VERIFICATION);
    }
  };

  const validate = useCallback(
    (values: FormOnyxValues<typeof ONYXKEYS.FORMS.EMAIL_FORM>): Errors => {
      const errors: FormInputErrors<typeof ONYXKEYS.FORMS.EMAIL_FORM> = {};

      if (values.email.length === 0) {
        ErrorUtils.addErrorMessage(
          errors,
          INPUT_IDS.EMAIL,
          translate('emailScreen.error.emailRequired'),
        );
      } else if (!ValidationUtils.isValidEmail(values.email)) {
        ErrorUtils.addErrorMessage(
          errors,
          INPUT_IDS.EMAIL,
          translate('emailScreen.error.invalidEmail'),
        );
      } else if (values.email === currentEmail) {
        ErrorUtils.addErrorMessage(
          errors,
          INPUT_IDS.EMAIL,
          translate('emailScreen.error.sameEmail'),
        );
      } else if (values.email.length > CONST.EMAIL_MAX_LENGTH) {
        ErrorUtils.addErrorMessage(
          errors,
          INPUT_IDS.EMAIL,
          translate('emailScreen.error.emailTooLong'),
        );
      }
      return errors;
    },
    [translate],
  );

  return (
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
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
          style={[styles.flexGrow1, styles.mh5]}>
          <View style={[styles.flexGrow1]}>
            <Text>{translate('emailScreen.prompt')}</Text>
            <InputWrapper
              InputComponent={TextInput}
              inputID={INPUT_IDS.EMAIL}
              name="email"
              autoGrowHeight
              maxAutoGrowHeight={variables.textInputAutoGrowMaxHeight}
              label={translate('emailScreen.enterEmail')}
              aria-label={translate('emailScreen.enterEmail')}
              defaultValue={currentEmail ?? ''}
              spellCheck={false}
              containerStyles={[styles.mt5]}
            />
          </View>
        </FormProvider>
      )}
    </ScreenWrapper>
  );
}

EmailScreen.displayName = 'EmailScreen';

export default EmailScreen;
