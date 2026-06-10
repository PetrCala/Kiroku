import React, {useState} from 'react';
import type {StackScreenProps} from '@react-navigation/stack';
import Button from '@components/Button';
import CheckboxWithLabel from '@components/CheckboxWithLabel';
import ConfirmModal from '@components/ConfirmModal';
import FixedFooter from '@components/FixedFooter';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import MenuItem from '@components/MenuItem';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as ErrorUtils from '@libs/ErrorUtils';
import Navigation from '@libs/Navigation/Navigation';
import type {ProfileNavigatorParamList} from '@libs/Navigation/types';
import * as Block from '@userActions/Block';
import * as Report from '@userActions/Report';
import type {ReportReason} from '@userActions/Report';
import CONST from '@src/CONST';
import ERRORS from '@src/ERRORS';
import type {TranslationPaths} from '@src/languages/types';
import type SCREENS from '@src/SCREENS';
import variables from '@src/styles/variables';

type ReportUserScreenProps = StackScreenProps<
  ProfileNavigatorParamList,
  typeof SCREENS.PROFILE.REPORT_USER
>;

// Pair each wire-contract reason (CONST.REPORT.REASON, shared with kiroku-api)
// with its English label key. The order here is the order shown to the user.
const REASONS = [
  {
    reason: CONST.REPORT.REASON.INAPPROPRIATE_NAME,
    translationKey: 'reportUserScreen.reasons.inappropriateName',
  },
  {
    reason: CONST.REPORT.REASON.INAPPROPRIATE_PHOTO,
    translationKey: 'reportUserScreen.reasons.inappropriatePhoto',
  },
  {
    reason: CONST.REPORT.REASON.HARASSMENT,
    translationKey: 'reportUserScreen.reasons.harassment',
  },
  {
    reason: CONST.REPORT.REASON.OTHER,
    translationKey: 'reportUserScreen.reasons.other',
  },
] as const satisfies ReadonlyArray<{
  reason: ReportReason;
  translationKey: TranslationPaths;
}>;

function ReportUserScreen({route}: ReportUserScreenProps) {
  const {userID} = route.params;
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(
    null,
  );
  const [description, setDescription] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [isSuccessVisible, setIsSuccessVisible] = useState(false);

  const onSubmit = () => {
    if (!selectedReason) {
      return;
    }
    // Compute the optional description outside the try/catch: the React Compiler
    // rejects value expressions (logical/ternary) inside a try block.
    const trimmedDescription = description.trim();
    const reportDescription =
      trimmedDescription.length > 0 ? trimmedDescription : undefined;
    try {
      // Fire-and-forget like feedback: the report is server-only/admin-reviewed,
      // so there is no optimistic Onyx state and no confirmation to wait on.
      Report.reportUser(userID, selectedReason, reportDescription);
      // Opt-in graft: block only after the report when the user asked for it.
      if (alsoBlock) {
        Block.blockUser(userID);
      }
      setIsSuccessVisible(true);
    } catch (error) {
      ErrorUtils.raiseAppError(ERRORS.USER.COULD_NOT_REPORT_USER, error);
    }
  };

  const onSuccessConfirm = () => {
    setIsSuccessVisible(false);
    Navigation.goBack();
  };

  return (
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
      testID={ReportUserScreen.displayName}>
      <HeaderWithBackButton
        title={translate('reportUserScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <ScrollView
        style={[styles.flex1]}
        contentContainerStyle={[styles.ph5, styles.pb5]}>
        <Text style={[styles.mb3]}>{translate('reportUserScreen.prompt')}</Text>
        {REASONS.map(({reason, translationKey}) => (
          <MenuItem
            key={reason}
            title={translate(translationKey)}
            shouldShowSelectedState
            isSelected={selectedReason === reason}
            onPress={() => setSelectedReason(reason)}
            wrapperStyle={[styles.ph0]}
          />
        ))}
        <TextInput
          accessibilityLabel={translate('reportUserScreen.descriptionLabel')}
          label={translate('reportUserScreen.descriptionLabel')}
          role={CONST.ROLE.PRESENTATION}
          value={description}
          onChangeText={setDescription}
          autoGrowHeight
          maxAutoGrowHeight={variables.textInputAutoGrowMaxHeight}
          maxLength={CONST.DESCRIPTION_LIMIT}
          spellCheck={false}
          containerStyles={[styles.mt5]}
        />
        <CheckboxWithLabel
          label={translate('reportUserScreen.alsoBlock')}
          accessibilityLabel={translate('reportUserScreen.alsoBlock')}
          isChecked={alsoBlock}
          onInputChange={value => setAlsoBlock(value ?? false)}
          style={[styles.mt5]}
        />
      </ScrollView>
      <FixedFooter>
        <Button
          success
          large
          text={translate('reportUserScreen.submit')}
          onPress={onSubmit}
          isDisabled={!selectedReason}
        />
      </FixedFooter>
      <ConfirmModal
        isVisible={isSuccessVisible}
        title={translate('reportUserScreen.successTitle')}
        prompt={translate('reportUserScreen.successMessage')}
        confirmText={translate('common.ok')}
        onConfirm={onSuccessConfirm}
        onCancel={onSuccessConfirm}
        shouldShowCancelButton={false}
        success
      />
    </ScreenWrapper>
  );
}

ReportUserScreen.displayName = 'ReportUserScreen';

export default ReportUserScreen;
