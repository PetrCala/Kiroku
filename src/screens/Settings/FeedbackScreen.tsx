import React, {useCallback} from 'react';
import {View} from 'react-native';
import FullscreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as ErrorUtils from '@libs/ErrorUtils';
import * as ValidationUtils from '@libs/ValidationUtils';
import type {SettingsNavigatorParamList} from '@libs/Navigation/types';
import type {FormOnyxValues} from '@src/components/Form/types';
import ONYXKEYS from '@src/ONYXKEYS';
import INPUT_IDS from '@src/types/form/FeedbackForm';
import FormProvider from '@components/Form/FormProvider';
import Text from '@components/Text';
import type {Errors} from '@src/types/onyx/OnyxCommon';
import InputWrapper from '@components/Form/InputWrapper';
import variables from '@src/styles/variables';
import CONST from '@src/CONST';
import TextInput from '@components/TextInput';
import type {StackScreenProps} from '@react-navigation/stack';
import type SCREENS from '@src/SCREENS';
import {submitFeedback} from '@database/feedback';
import {useFirebase} from '@context/global/FirebaseContext';
import ERRORS from '@src/ERRORS';

type FeedbackScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.DELETE
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FeedbackScreen({route}: FeedbackScreenProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const {db, auth} = useFirebase();
  const userID = auth.currentUser?.uid;

  const [isLoading, setIsLoading] = React.useState(false);

  const onSubmit = (
    values: FormOnyxValues<typeof ONYXKEYS.FORMS.FEEDBACK_FORM>,
  ) => {
    (async () => {
      try {
        setIsLoading(true);
        await submitFeedback(db, userID, values);
        Navigation.goBack();
      } catch (error) {
        ErrorUtils.raiseAppError(ERRORS.USER.FEEDBACK_SUBMISSION_FAILED, error);
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const validate = useCallback(
    (values: FormOnyxValues<typeof ONYXKEYS.FORMS.FEEDBACK_FORM>): Errors => {
      const errors = ValidationUtils.getFieldRequiredErrors(values, ['text']);
      return errors;
    },
    [],
  );

  return (
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
      testID={FeedbackScreen.displayName}>
      <HeaderWithBackButton
        title={translate('feedbackScreen.title')}
        shouldShowBackButton
        onBackButtonPress={Navigation.goBack}
      />
      {isLoading ? (
        <FullscreenLoadingIndicator
          style={[styles.flex1]}
          loadingText={translate('feedbackScreen.sending')}
        />
      ) : (
        <FormProvider
          formID={ONYXKEYS.FORMS.FEEDBACK_FORM}
          validate={validate}
          onSubmit={onSubmit}
          submitButtonText={translate('feedbackScreen.submit')}
          style={[styles.flexGrow1, styles.mh5]}>
          <View style={[styles.flexGrow1]}>
            <Text>{translate('feedbackScreen.prompt')}</Text>
            <InputWrapper
              InputComponent={TextInput}
              inputID={INPUT_IDS.TEXT}
              autoGrowHeight
              maxAutoGrowHeight={variables.textInputAutoGrowMaxHeight}
              label={translate('feedbackScreen.enterFeedback')}
              aria-label={translate('feedbackScreen.enterFeedback')}
              role={CONST.ROLE.PRESENTATION}
              maxLength={CONST.DESCRIPTION_LIMIT}
              spellCheck={false}
              containerStyles={[styles.mt5]}
            />
          </View>
        </FormProvider>
      )}
    </ScreenWrapper>
  );
}

FeedbackScreen.displayName = 'FeedbackScreen';

export default FeedbackScreen;
