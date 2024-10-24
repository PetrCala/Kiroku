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
import Navigation from '@libs/Navigation/Navigation';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as ValidationUtils from '@libs/ValidationUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import INPUT_IDS from '@src/types/form/UserNameForm';
import {StackScreenProps} from '@react-navigation/stack';
import {SettingsNavigatorParamList} from '@libs/Navigation/types';
import SCREENS from '@src/SCREENS';
import {useFirebase} from '@context/global/FirebaseContext';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {changeUserName} from '@database/users';

type UserNameScreenOnyxProps = {};

type UserNameScreenProps = UserNameScreenOnyxProps &
  StackScreenProps<
    SettingsNavigatorParamList,
    typeof SCREENS.SETTINGS.ACCOUNT.USER_NAME
  >;

function UserNameScreen({}: UserNameScreenProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  const {db, auth} = useFirebase();
  const {userData, isLoading} = useDatabaseData();
  const profileData = userData?.profile;

  const [isLoadingName, setIsLoadingName] = React.useState(false);
  const [loadingText, setLoadingText] = React.useState('');

  const currentUserDetails = {
    firstName: profileData?.first_name,
    lastName: profileData?.last_name,
  };

  const updateUserName = async (
    values: FormOnyxValues<typeof ONYXKEYS.FORMS.USER_NAME_FORM>,
  ) => {
    const newFirstName = values.firstName.trim();
    const newLastName = values.lastName.trim();

    try {
      setLoadingText(translate('userNameScreen.updatingUserName'));
      setIsLoadingName(true);
      await changeUserName(db, auth.currentUser, newFirstName, newLastName);
      Navigation.goBack();
    } catch (error: any) {
      ErrorUtils.raiseAlert(error, translate('userNameScreen.error.generic'));
    } finally {
      setLoadingText('');
      setIsLoadingName(false);
    }
  };

  const validate = (
    values: FormOnyxValues<typeof ONYXKEYS.FORMS.USER_NAME_FORM>,
  ) => {
    const errors: FormInputErrors<typeof ONYXKEYS.FORMS.USER_NAME_FORM> = {};

    // First we validate the first name field
    // We use display and user name interchangeably
    if (!ValidationUtils.isValidDisplayName(values.firstName)) {
      ErrorUtils.addErrorMessage(
        errors,
        'firstName',
        translate('personalDetails.error.hasInvalidCharacter'),
      );
    } else if (values.firstName.length > CONST.TITLE_CHARACTER_LIMIT) {
      ErrorUtils.addErrorMessage(
        errors,
        'firstName',
        translate('common.error.characterLimitExceedCounter', {
          length: values.firstName.length,
          limit: CONST.TITLE_CHARACTER_LIMIT,
        }),
      );
    } else if (values.firstName.length === 0) {
      ErrorUtils.addErrorMessage(
        errors,
        'firstName',
        translate('personalDetails.error.requiredFirstName'),
      );
    }
    if (
      ValidationUtils.doesContainReservedWord(
        values.firstName,
        CONST.DISPLAY_NAME.RESERVED_NAMES,
      )
    ) {
      ErrorUtils.addErrorMessage(
        errors,
        'firstName',
        translate('personalDetails.error.containsReservedWord'),
      );
    }

    // Then we validate the last name field
    if (!ValidationUtils.isValidDisplayName(values.lastName)) {
      ErrorUtils.addErrorMessage(
        errors,
        'lastName',
        translate('personalDetails.error.hasInvalidCharacter'),
      );
    } else if (values.lastName.length > CONST.TITLE_CHARACTER_LIMIT) {
      ErrorUtils.addErrorMessage(
        errors,
        'lastName',
        translate('common.error.characterLimitExceedCounter', {
          length: values.lastName.length,
          limit: CONST.TITLE_CHARACTER_LIMIT,
        }),
      );
    }
    if (
      ValidationUtils.doesContainReservedWord(
        values.lastName,
        CONST.DISPLAY_NAME.RESERVED_NAMES,
      )
    ) {
      ErrorUtils.addErrorMessage(
        errors,
        'lastName',
        translate('personalDetails.error.containsReservedWord'),
      );
    }
    return errors;
  };

  return (
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
      shouldEnableMaxHeight
      testID={UserNameScreen.userName}>
      <HeaderWithBackButton
        title={translate('userNameScreen.headerTitle')}
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
          formID={ONYXKEYS.FORMS.USER_NAME_FORM}
          validate={validate}
          onSubmit={updateUserName}
          submitButtonText={translate('common.save')}
          enabledWhenOffline
          shouldValidateOnBlur
          shouldValidateOnChange>
          <Text style={[styles.mb6]}>
            {translate('userNameScreen.explanation')}
          </Text>
          <View style={styles.mb4}>
            <InputWrapper
              InputComponent={TextInput}
              inputID={INPUT_IDS.FIRST_NAME}
              name="fname"
              label={translate('common.firstName')}
              aria-label={translate('common.firstName')}
              role={CONST.ROLE.PRESENTATION}
              defaultValue={currentUserDetails.firstName ?? ''}
              spellCheck={false}
            />
          </View>
          <View>
            <InputWrapper
              InputComponent={TextInput}
              inputID={INPUT_IDS.LAST_NAME}
              name="lname"
              label={translate('common.lastName')}
              aria-label={translate('common.lastName')}
              role={CONST.ROLE.PRESENTATION}
              defaultValue={currentUserDetails.lastName ?? ''}
              spellCheck={false}
            />
          </View>
        </FormProvider>
      )}
    </ScreenWrapper>
  );
}

UserNameScreen.userName = 'UserNameScreen';

export default withOnyx<UserNameScreenProps, UserNameScreenOnyxProps>({})(
  UserNameScreen,
);
