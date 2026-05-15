import React, {useState} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import FormProvider from '@components/Form/FormProvider';
import InputWrapper from '@components/Form/InputWrapper';
import type {FormInputErrors, FormOnyxValues} from '@components/Form/types';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import OnboardingScreenLayout from '@components/OnboardingScreenLayout';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as ErrorUtils from '@libs/ErrorUtils';
import type {OnboardingModalNavigatorParamList} from '@libs/Navigation/types';
import * as ValidationUtils from '@libs/ValidationUtils';
import * as Onboarding from '@userActions/Onboarding';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import INPUT_IDS from '@src/types/form/PickUsernameForm';
import type {StackScreenProps} from '@react-navigation/stack';

type DisplayNameScreenProps = StackScreenProps<
  OnboardingModalNavigatorParamList,
  typeof SCREENS.ONBOARDING.DISPLAY_NAME
>;

// eslint-disable-next-line no-empty-pattern
function DisplayNameScreen({}: DisplayNameScreenProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {db, auth} = useFirebase();
  const [loadingText] = useOnyx(ONYXKEYS.APP_LOADING_TEXT);
  const {userData} = useDatabaseData();
  const currentDisplayName = userData?.profile?.display_name ?? '';
  const [isSaving, setIsSaving] = useState(false);
  const [serverErrorMessage, setServerErrorMessage] = useState('');

  const onSubmit = (
    values: FormOnyxValues<typeof ONYXKEYS.FORMS.PICK_USERNAME_FORM>,
  ) => {
    (async () => {
      if (isSaving) {
        return;
      }
      setIsSaving(true);
      try {
        await Onboarding.setDisplayName(
          db,
          auth.currentUser,
          currentDisplayName,
          values.username,
        );
        await Onboarding.completeOnboarding(db, auth.currentUser);
        Onboarding.navigateAfterOnboarding();
      } catch (error) {
        const appError = ErrorUtils.getAppError(undefined, error);
        setServerErrorMessage(
          appError.message || translate('pickUsernameScreen.error.generic'),
        );
      } finally {
        setIsSaving(false);
      }
    })();
  };

  const validate = (
    values: FormOnyxValues<typeof ONYXKEYS.FORMS.PICK_USERNAME_FORM>,
  ) => {
    const errors: FormInputErrors<typeof ONYXKEYS.FORMS.PICK_USERNAME_FORM> =
      {};
    setServerErrorMessage('');
    const errorKey = ValidationUtils.validateUsername(values.username);
    if (errorKey) {
      ErrorUtils.addErrorMessage(
        errors,
        INPUT_IDS.USERNAME,
        translate(errorKey),
      );
    }
    return errors;
  };

  return (
    <OnboardingScreenLayout
      testID={DisplayNameScreen.displayName}
      currentStep={2}
      totalSteps={2}
      hasMore={false}>
      {isSaving || !!loadingText ? (
        <FullScreenLoadingIndicator
          style={[styles.flex1]}
          loadingText={loadingText ?? translate('pickUsernameScreen.saving')}
        />
      ) : (
        <FormProvider
          style={[styles.flexGrow1, styles.ph5]}
          formID={ONYXKEYS.FORMS.PICK_USERNAME_FORM}
          validate={validate}
          onSubmit={onSubmit}
          submitButtonText={translate('common.continue')}
          shouldValidateOnBlur={false}
          shouldValidateOnChange>
          <Text style={[styles.textHeadlineH1, styles.mt5, styles.mb2]}>
            {translate('pickUsernameScreen.heading')}
          </Text>
          <Text style={[styles.textNormal, styles.mb6]}>
            {translate('pickUsernameScreen.explainer')}
          </Text>
          <View style={styles.mb4}>
            <InputWrapper
              InputComponent={TextInput}
              inputID={INPUT_IDS.USERNAME}
              name="username"
              label={translate('common.username')}
              aria-label={translate('common.username')}
              role={CONST.ROLE.PRESENTATION}
              defaultValue={currentDisplayName}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {!!serverErrorMessage && (
            <Text style={[styles.formError, styles.mt2]}>
              {serverErrorMessage}
            </Text>
          )}
        </FormProvider>
      )}
    </OnboardingScreenLayout>
  );
}

DisplayNameScreen.displayName = 'DisplayNameScreen';

export default DisplayNameScreen;
