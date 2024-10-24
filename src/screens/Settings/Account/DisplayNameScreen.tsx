import React from 'react';
import {Alert, View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import FormProvider from '@components/Form/FormProvider';
import InputWrapper from '@components/Form/InputWrapper';
import type {FormInputErrors, FormOnyxValues} from '@components/Form/types';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
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
import INPUT_IDS from '@src/types/form/DisplayNameForm';
import {StackScreenProps} from '@react-navigation/stack';
import {SettingsNavigatorParamList} from '@libs/Navigation/types';
import SCREENS from '@src/SCREENS';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import {changeDisplayName} from '@database/users';

type DisplayNameScreenOnyxProps = {};

type DisplayNameScreenProps = DisplayNameScreenOnyxProps &
  StackScreenProps<
    SettingsNavigatorParamList,
    typeof SCREENS.SETTINGS.ACCOUNT.DISPLAY_NAME
  >;

function DisplayNameScreen({}: DisplayNameScreenProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  const {db, auth} = useFirebase();
  const {userData, isLoading} = useDatabaseData();
  const profileData = userData?.profile;

  const [isLoadingName, setIsLoadingName] = React.useState(false);
  const [loadingText, setLoadingText] = React.useState('');

  const currentUserDetails = {
    displayName: profileData?.display_name,
  };

  /**
   * Submit form to update user's display
   */
  const updateDisplayName = async (
    values: FormOnyxValues<typeof ONYXKEYS.FORMS.DISPLAY_NAME_FORM>,
  ) => {
    const newDisplayName = values.displayName.trim();
    try {
      setLoadingText(translate('displayNameScreen.updatingDisplayName'));
      setIsLoadingName(true);
      await changeDisplayName(
        db,
        auth.currentUser,
        profileData?.display_name,
        newDisplayName,
      );
    } catch (error: any) {
      ErrorUtils.raiseAlert(
        error,
        translate('displayNameScreen.error.generic'),
      );
    } finally {
      Navigation.goBack();
      setLoadingText('');
      setIsLoadingName(false);
    }
  };

  const validate = (
    values: FormOnyxValues<typeof ONYXKEYS.FORMS.DISPLAY_NAME_FORM>,
  ) => {
    const errors: FormInputErrors<typeof ONYXKEYS.FORMS.DISPLAY_NAME_FORM> = {};

    if (!ValidationUtils.isValidDisplayName(values.displayName)) {
      ErrorUtils.addErrorMessage(
        errors,
        'displayName',
        translate('personalDetails.error.hasInvalidCharacter'),
      );
    } else if (values.displayName.length > CONST.TITLE_CHARACTER_LIMIT) {
      ErrorUtils.addErrorMessage(
        errors,
        'displayName',
        translate('common.error.characterLimitExceedCounter', {
          length: values.displayName.length,
          limit: CONST.TITLE_CHARACTER_LIMIT,
        }),
      );
    } else if (values.displayName.length === 0) {
      ErrorUtils.addErrorMessage(
        errors,
        'displayName',
        translate('personalDetails.error.requiredDisplayName'),
      );
    }
    if (
      ValidationUtils.doesContainReservedWord(
        values.displayName,
        CONST.DISPLAY_NAME.RESERVED_NAMES,
      )
    ) {
      ErrorUtils.addErrorMessage(
        errors,
        'displayName',
        translate('personalDetails.error.containsReservedWord'),
      );
    }

    return errors;
  };

  return (
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
      shouldEnableMaxHeight
      testID={DisplayNameScreen.displayName}>
      <HeaderWithBackButton
        title={translate('displayNameScreen.headerTitle')}
        onBackButtonPress={() => Navigation.goBack()}
      />
      {isLoading || isLoadingName ? (
        <FullScreenLoadingIndicator
          style={[styles.flex1]}
          loadingText={loadingText}
        />
      ) : (
        <FormProvider
          style={[styles.flexGrow1, styles.ph5]}
          formID={ONYXKEYS.FORMS.DISPLAY_NAME_FORM}
          validate={validate}
          onSubmit={updateDisplayName}
          submitButtonText={translate('common.save')}
          enabledWhenOffline
          shouldValidateOnBlur
          shouldValidateOnChange>
          <Text style={[styles.mb6]}>
            {translate('displayNameScreen.isShownOnProfile')}
          </Text>
          <View style={styles.mb4}>
            <InputWrapper
              InputComponent={TextInput}
              inputID={INPUT_IDS.DISPLAY_NAME}
              name="displayName"
              label={translate('common.displayName')}
              aria-label={translate('common.displayName')}
              role={CONST.ROLE.PRESENTATION}
              defaultValue={currentUserDetails.displayName ?? ''}
              spellCheck={false}
            />
          </View>
        </FormProvider>
      )}
    </ScreenWrapper>
  );
}

DisplayNameScreen.displayName = 'DisplayNameScreen';

export default withOnyx<DisplayNameScreenProps, DisplayNameScreenOnyxProps>({})(
  DisplayNameScreen,
);
