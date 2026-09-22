import React, {useCallback} from 'react';
import type {StackScreenProps} from '@react-navigation/stack';
import FormProvider from '@components/Form/FormProvider';
import InputWrapper from '@components/Form/InputWrapper';
import type {FormOnyxValues} from '@components/Form/types';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import useCurrentUserDrinkingSessions from '@hooks/useCurrentUserDrinkingSessions';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as DSUtils from '@libs/DrinkingSessionUtils';
import * as ErrorUtils from '@libs/ErrorUtils';
import Navigation from '@libs/Navigation/Navigation';
import type {DrinkingSessionNavigatorParamList} from '@libs/Navigation/types';
import {getSessionDisplayName} from '@libs/SessionName';
import * as ValidationUtils from '@libs/ValidationUtils';
import * as DS from '@userActions/DrinkingSession';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import INPUT_IDS from '@src/types/form/SessionNameForm';

type SessionNameScreenProps = StackScreenProps<
  DrinkingSessionNavigatorParamList,
  typeof SCREENS.DRINKING_SESSION.SESSION_NAME_SCREEN
>;

/**
 * Rename a session (RFC §9). Reached from the session's summary and from the
 * session details of a live or edited session, so it resolves the session from
 * the live/edit buffer first and falls back to the user's stored sessions.
 *
 * The rename works offline: a buffered session is renamed locally and saved
 * with the session, and a stored one goes through the persisted write queue
 * with optimistic data. The form therefore submits offline too.
 */
function SessionNameScreen({route}: SessionNameScreenProps) {
  const {sessionId, backTo} = route.params;
  const {translate} = useLocalize();
  const styles = useThemeStyles();
  const drinkingSessions = useCurrentUserDrinkingSessions();
  const session =
    DSUtils.getDrinkingSessionData(sessionId) ?? drinkingSessions?.[sessionId];

  const onSubmit = (
    values: FormOnyxValues<typeof ONYXKEYS.FORMS.SESSION_NAME_FORM>,
  ) => {
    DS.updateSessionName(sessionId, session, values.name);
    Navigation.goBack(backTo);
  };

  const validate = useCallback(
    (values: FormOnyxValues<typeof ONYXKEYS.FORMS.SESSION_NAME_FORM>) => {
      const errors = {};

      if (values.name.trim().length === 0) {
        ErrorUtils.addErrorMessage(
          errors,
          INPUT_IDS.NAME,
          translate('sessionNameScreen.error.nameRequired'),
        );
      } else if (values.name.length > CONST.SESSION_NAME_CHARACTER_LIMIT) {
        ErrorUtils.addErrorMessage(
          errors,
          INPUT_IDS.NAME,
          translate('common.error.characterLimitExceedCounter', {
            length: values.name.length,
            limit: CONST.SESSION_NAME_CHARACTER_LIMIT,
          }),
        );
      } else if (!ValidationUtils.isValidSessionName(values.name)) {
        ErrorUtils.addErrorMessage(
          errors,
          INPUT_IDS.NAME,
          translate('personalDetails.error.containsProfanity'),
        );
      }

      return errors;
    },
    [translate],
  );

  return (
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
      shouldShowOfflineIndicator={false}
      testID={SessionNameScreen.displayName}>
      <HeaderWithBackButton
        title={translate('sessionNameScreen.title')}
        onBackButtonPress={() => Navigation.goBack(backTo)}
      />
      <FormProvider
        style={[styles.flexGrow1, styles.ph5]}
        formID={ONYXKEYS.FORMS.SESSION_NAME_FORM}
        validate={validate}
        onSubmit={onSubmit}
        submitButtonText={translate('common.save')}
        enabledWhenOffline>
        <Text style={[styles.mb6]}>
          {translate('sessionNameScreen.nameDescription')}
        </Text>
        <InputWrapper
          InputComponent={TextInput}
          inputID={INPUT_IDS.NAME}
          label={translate('common.name')}
          defaultValue={getSessionDisplayName(session)}
          maxLength={CONST.SESSION_NAME_CHARACTER_LIMIT}
        />
      </FormProvider>
    </ScreenWrapper>
  );
}

SessionNameScreen.displayName = 'SessionNameScreen';
export default SessionNameScreen;
