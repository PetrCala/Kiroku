import React, {useCallback} from 'react';
import {View} from 'react-native';
import FullscreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as ValidationUtils from '@libs/ValidationUtils';
import * as User from '@userActions/User';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as Browser from '@libs/Browser';
import type {SettingsNavigatorParamList} from '@libs/Navigation/types';
import type {FormOnyxValues} from '@src/components/Form/types';
import ONYXKEYS from '@src/ONYXKEYS';
import INPUT_IDS from '@src/types/form/PasswordForm';
import FormProvider from '@components/Form/FormProvider';
import Text from '@components/Text';
import type {Errors} from '@src/types/onyx/OnyxCommon';
import InputWrapper from '@components/Form/InputWrapper';
import CONST from '@src/CONST';
import TextInput from '@components/TextInput';
import type {StackScreenProps} from '@react-navigation/stack';
import type SCREENS from '@src/SCREENS';
import {useFirebase} from '@context/global/FirebaseContext';
import DotIndicatorMessage from '@components/DotIndicatorMessage';
import type {TranslationPaths} from '@src/languages/types';
import type {ValueOf} from 'type-fest';

type PasswordScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.ACCOUNT.PASSWORD
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PasswordScreen({route}: PasswordScreenProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {auth} = useFirebase();
  const user = auth.currentUser;
  const [serverErrorMessage, setServerErrorMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const onSubmit = (
    values: FormOnyxValues<typeof ONYXKEYS.FORMS.PASSWORD_FORM>,
  ) => {
    (async () => {
      setIsLoading(true);

      try {
        await User.updatePassword(
          user,
          values.currentPassword,
          values.newPassword,
        );
        Navigation.goBack(); // TODO add a success message
      } catch (error) {
        ErrorUtils.raiseAppError(undefined, error);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const validate = useCallback(
    (values: FormOnyxValues<typeof ONYXKEYS.FORMS.PASSWORD_FORM>): Errors => {
      setServerErrorMessage('');

      const errors = ValidationUtils.getFieldRequiredErrors(values, [
        'currentPassword',
      ]);

      type ErrorDataItem = {
        errorKey: TranslationPaths | null;
        formKey: ValueOf<typeof INPUT_IDS>;
      };

      const errorData: ErrorDataItem[] = [
        {
          errorKey: ValidationUtils.validatePassword(
            values.newPassword,
            values.currentPassword,
          ),
          formKey: INPUT_IDS.NEW_PASSWORD,
        },
        {
          errorKey:
            values.newPassword &&
            values.reEnterPassword &&
            values.newPassword !== values.reEnterPassword
              ? 'password.error.passwordsMustMatch'
              : null,
          formKey: INPUT_IDS.RE_ENTER_PASSWORD,
        },
      ];

      for (const {errorKey, formKey} of errorData) {
        if (errorKey) {
          ErrorUtils.addErrorMessage(errors, formKey, translate(errorKey));
        }
      }

      return errors;
    },
    [translate],
  );

  return (
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
      shouldShowOfflineIndicator={false}
      testID={PasswordScreen.displayName}>
      <HeaderWithBackButton
        title={translate('passwordScreen.title')}
        shouldShowBackButton
        onBackButtonPress={Navigation.goBack}
      />
      {isLoading ? (
        <FullscreenLoadingIndicator
          style={[styles.flex1]}
          loadingText={translate('password.changingPassword')}
        />
      ) : (
        <FormProvider
          formID={ONYXKEYS.FORMS.PASSWORD_FORM}
          validate={validate}
          onSubmit={onSubmit}
          submitButtonText={translate('passwordScreen.submit')}
          style={[styles.flexGrow1, styles.mh5]}>
          <View style={[styles.flexGrow1]}>
            <Text>{translate('passwordScreen.prompt')}</Text>
            <InputWrapper
              InputComponent={TextInput}
              inputID={INPUT_IDS.CURRENT_PASSWORD}
              label={translate('password.currentPassword')}
              aria-label={translate('password.currentPassword')}
              shouldSaveDraft
              defaultValue=""
              spellCheck={false}
              secureTextEntry
              autoComplete={
                Browser.getBrowser() === CONST.BROWSER.SAFARI
                  ? 'username'
                  : 'off'
              }
              containerStyles={styles.mt4}
            />
            <InputWrapper
              InputComponent={TextInput}
              inputID={INPUT_IDS.NEW_PASSWORD}
              name="password"
              label={translate('password.newPassword')}
              aria-label={translate('password.newPassword')}
              shouldSaveDraft
              defaultValue=""
              spellCheck={false}
              secureTextEntry
              autoComplete={
                Browser.getBrowser() === CONST.BROWSER.SAFARI
                  ? 'username'
                  : 'off'
              }
              containerStyles={styles.mt4}
            />
            <InputWrapper
              InputComponent={TextInput}
              inputID={INPUT_IDS.RE_ENTER_PASSWORD}
              name="re-enter-password"
              label={translate('password.reEnter')}
              aria-label={translate('password.reEnter')}
              shouldSaveDraft
              defaultValue=""
              spellCheck={false}
              secureTextEntry
              autoComplete={
                Browser.getBrowser() === CONST.BROWSER.SAFARI
                  ? 'username'
                  : 'off'
              }
              containerStyles={styles.mt4}
            />
            {!!serverErrorMessage && (
              <DotIndicatorMessage
                style={[styles.mv2]}
                type="error"
                // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/prefer-nullish-coalescing
                messages={{0: serverErrorMessage || ''}}
              />
            )}
          </View>
        </FormProvider>
      )}
    </ScreenWrapper>
  );
}

PasswordScreen.displayName = 'PasswordScreen';

export default PasswordScreen;
