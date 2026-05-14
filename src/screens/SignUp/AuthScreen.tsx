import React, {useCallback, useRef, useState} from 'react';
import {View} from 'react-native';
import {useFirebase} from '@context/global/FirebaseContext';
import ScreenWrapper from '@components/ScreenWrapper';
import useThemeStyles from '@hooks/useThemeStyles';
import useStyleUtils from '@hooks/useStyleUtils';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useStyledSafeAreaInsets from '@hooks/useStyledSafeAreaInsets';
import useLocalize from '@hooks/useLocalize';
import INPUT_IDS from '@src/types/form/AuthForm';
import ONYXKEYS from '@src/ONYXKEYS';
import FormProvider from '@components/Form/FormProvider';
import type {FormInputErrors, FormOnyxValues} from '@components/Form/types';
import type {Errors} from '@src/types/onyx/OnyxCommon';
import InputWrapper from '@components/Form/InputWrapper';
import TextInput from '@components/TextInput';
import CONST from '@src/CONST';
import * as ValidationUtils from '@libs/ValidationUtils';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as Browser from '@libs/Browser';
import * as User from '@userActions/User';
import Text from '@components/Text';
import {PressableWithFeedback} from '@components/Pressable';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import DotIndicatorMessage from '@components/DotIndicatorMessage';
import {useUserConnection} from '@context/global/UserConnectionContext';
import AppleSignIn from '@components/SignInButtons/AppleSignIn';
import GoogleSignIn from '@components/SignInButtons/GoogleSignIn';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import type {TranslationPaths} from '@src/languages/types';
import OrDelimiter from './OrDelimiter';
import SignUpScreenLayout from './SignUpScreenLayout';

type AuthScreenLayoutRef = {
  scrollPageToTop: (animated?: boolean) => void;
};

type AuthMode = 'signUp' | 'logIn';

function AuthScreen() {
  const {isOnline} = useUserConnection();
  const {db, auth} = useFirebase();
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const StyleUtils = useStyleUtils();
  const {isInNarrowPaneModal} = useResponsiveLayout();
  const safeAreaInsets = useStyledSafeAreaInsets();
  const currentScreenLayoutRef = useRef<AuthScreenLayoutRef>(null);
  const [mode, setMode] = useState<AuthMode>('signUp');
  const [isLoading, setIsLoading] = useState(false);
  const [serverErrorMessage, setServerErrorMessage] = useState('');

  const isSignUp = mode === 'signUp';

  const onToggleMode = () => {
    setServerErrorMessage('');
    setMode(prev => (prev === 'signUp' ? 'logIn' : 'signUp'));
  };

  const onSubmit = (
    values: FormOnyxValues<typeof ONYXKEYS.FORMS.AUTH_FORM>,
  ) => {
    (async () => {
      if (!isOnline || isLoading) {
        return;
      }
      setIsLoading(true);
      const emailTrim = values.email.trim();
      try {
        if (isSignUp) {
          await User.signUp(db, auth, emailTrim, values.password);
        } else {
          await User.logIn(auth, emailTrim, values.password);
        }
      } catch (error) {
        const appError = ErrorUtils.getAppError(undefined, error);
        setServerErrorMessage(appError.message);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const validate = useCallback(
    (values: FormOnyxValues<typeof ONYXKEYS.FORMS.AUTH_FORM>): Errors => {
      const errors: FormInputErrors<typeof ONYXKEYS.FORMS.AUTH_FORM> = {};
      setServerErrorMessage('');

      type ErrorDataItem = {
        errorKey: TranslationPaths | null;
        formKey: keyof typeof errors;
      };

      // Sign-up enforces password complexity; log-in only requires non-empty.
      let passwordErrorKey: TranslationPaths | null;
      if (isSignUp) {
        passwordErrorKey = ValidationUtils.validatePassword(values.password);
      } else {
        passwordErrorKey = values.password
          ? null
          : 'password.pleaseFillPassword';
      }

      const errorData: ErrorDataItem[] = [
        {
          errorKey: ValidationUtils.validateEmail(values.email),
          formKey: INPUT_IDS.EMAIL,
        },
        {
          errorKey: passwordErrorKey,
          formKey: INPUT_IDS.PASSWORD,
        },
      ];

      for (const {errorKey, formKey} of errorData) {
        if (errorKey) {
          ErrorUtils.addErrorMessage(errors, formKey, translate(errorKey));
        }
      }

      return errors;
    },
    [isSignUp, translate],
  );

  const navigateFocus = () => {
    currentScreenLayoutRef.current?.scrollPageToTop();
  };

  const submitButtonText = translate(
    isSignUp ? 'common.createAccount' : 'common.logIn',
  );
  const toggleHelperText = translate(
    isSignUp ? 'login.existingAccount' : 'login.noAccount',
  );
  const toggleActionText = translate(
    isSignUp ? 'common.logInHere' : 'common.signUpHere',
  );

  return (
    <ScreenWrapper
      shouldShowOfflineIndicator={false}
      shouldEnableMaxHeight
      shouldUseCachedViewportHeight
      style={[
        styles.signUpScreen,
        StyleUtils.getSignUpSafeAreaPadding(
          safeAreaInsets,
          isInNarrowPaneModal,
        ),
      ]}
      testID={AuthScreen.displayName}>
      {isLoading ? (
        <FullScreenLoadingIndicator
          loadingText={translate(
            isSignUp ? 'signUpScreen.signingIn' : 'logInScreen.loggingIn',
          )}
        />
      ) : (
        <SignUpScreenLayout
          welcomeHeader=""
          welcomeText=""
          ref={currentScreenLayoutRef}
          navigateFocus={navigateFocus}>
          <View
            style={[
              styles.flexRow,
              styles.justifyContentCenter,
              styles.gap3,
              styles.mb4,
            ]}>
            <AppleSignIn />
            <GoogleSignIn />
          </View>
          <OrDelimiter containerStyle={styles.mb4} />
          <FormProvider
            formID={ONYXKEYS.FORMS.AUTH_FORM}
            validate={validate}
            onSubmit={onSubmit}
            shouldValidateOnBlur={false}
            shouldValidateOnChange
            includeSafeAreaPaddingBottom={false}
            submitButtonText={submitButtonText}
            submitButtonStyles={styles.pb5}
            isSubmitButtonVisible={!isLoading}
            shouldUseScrollView={false}
            style={styles.flexGrow1}>
            <InputWrapper
              InputComponent={TextInput}
              inputID={INPUT_IDS.EMAIL}
              name="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              label={translate('login.email')}
              aria-label={translate('login.email')}
              defaultValue=""
              spellCheck={false}
            />
            <InputWrapper
              InputComponent={TextInput}
              inputID={INPUT_IDS.PASSWORD}
              name="password"
              label={translate('common.password')}
              aria-label={translate('common.password')}
              defaultValue=""
              spellCheck={false}
              secureTextEntry
              autoComplete={
                Browser.getBrowser() === CONST.BROWSER.SAFARI
                  ? 'username'
                  : 'off'
              }
            />
            {!isSignUp && (
              <PressableWithFeedback
                style={[styles.link, styles.mt4]}
                onPress={() => Navigation.navigate(ROUTES.FORGOT_PASSWORD)}
                role={CONST.ROLE.LINK}
                accessibilityLabel={translate('password.forgot')}>
                <Text style={styles.link}>{translate('password.forgot')}</Text>
              </PressableWithFeedback>
            )}
            {!!serverErrorMessage && (
              <DotIndicatorMessage
                style={[styles.mv2]}
                type="error"
                // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/prefer-nullish-coalescing
                messages={{0: serverErrorMessage || ''}}
              />
            )}
          </FormProvider>
          <View style={styles.changeSignUpScreenLinkContainer}>
            <Text style={styles.mr1}>{toggleHelperText}</Text>
            <PressableWithFeedback
              style={[styles.link]}
              onPress={onToggleMode}
              role={CONST.ROLE.BUTTON}
              accessibilityLabel={toggleActionText}>
              <Text style={[styles.link]}>{toggleActionText}</Text>
            </PressableWithFeedback>
          </View>
        </SignUpScreenLayout>
      )}
    </ScreenWrapper>
  );
}

AuthScreen.displayName = 'Auth Screen';
export default AuthScreen;
