import React, {useState} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import FormProvider from '@components/Form/FormProvider';
import InputWrapper from '@components/Form/InputWrapper';
import type {FormInputErrors, FormOnyxValues} from '@components/Form/types';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as ValidationUtils from '@libs/ValidationUtils';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import INPUT_IDS from '@src/types/form/PickUsernameForm';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import {setUsername} from '@userActions/User';

function PickUsernameScreen() {
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
        await setUsername(
          db,
          auth.currentUser,
          currentDisplayName,
          values.username,
        );
        Navigation.navigate(ROUTES.HOME);
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
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
      shouldEnableMaxHeight
      testID={PickUsernameScreen.displayName}>
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
    </ScreenWrapper>
  );
}

PickUsernameScreen.displayName = 'PickUsernameScreen';
export default PickUsernameScreen;
