import React, {useCallback, useMemo} from 'react';
import {useOnyx} from 'react-native-onyx';
import Modal from '@components/Modal';
import SafeAreaConsumer from '@components/SafeAreaConsumer';
import TermsScreenContent from '@components/TermsScreenContent';
import {useConfig} from '@context/global/ConfigContext';
import {useFirebase} from '@context/global/FirebaseContext';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useLocalize from '@hooks/useLocalize';
import * as Onboarding from '@userActions/Onboarding';
import {
  hasAcceptedCurrentTerms,
  hasCompletedOnboarding,
} from '@libs/OnboardingSelectors';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {View} from 'react-native';

/**
 * Prompts users who have already completed onboarding but whose accepted
 * Terms & Conditions version is stale. Renders a non-dismissable modal
 * **outside** the onboarding modal navigator so new-account onboarding and
 * post-onboarding re-consent stay independent flows.
 */
function TermsReConsentGuard() {
  const {auth} = useFirebase();
  const {translate} = useLocalize();
  const {config} = useConfig();
  // `useCurrentUserData` returns {} (truthy) while loading; the selectors below
  // expect `undefined` to mean "not loaded yet", so map empty → undefined.
  const currentUserData = useCurrentUserData();
  const userData = isEmptyObject(currentUserData) ? undefined : currentUserData;
  const [isLoadingApp] = useOnyx(ONYXKEYS.IS_LOADING_APP);

  const shouldPrompt = useMemo(() => {
    if (!auth?.currentUser) {
      return false;
    }
    // Defer until the OpenApp bootstrap completes and the record is present.
    // `USER_DATA_LIST` hydrates incrementally, so a partial record (e.g. a
    // profile-only batch merge that lacks `agreed_to_terms_at`) would otherwise
    // flash this modal at a returning user before their real terms-acceptance
    // has loaded.
    if (isLoadingApp !== false || userData === undefined) {
      return false;
    }
    if (!hasCompletedOnboarding(userData)) {
      return false;
    }
    return !hasAcceptedCurrentTerms(userData, config);
  }, [auth?.currentUser, isLoadingApp, userData, config]);

  const handleAccept = useCallback(() => {
    Onboarding.acceptTerms();
  }, []);

  if (!shouldPrompt) {
    return null;
  }

  return (
    <SafeAreaConsumer>
      {({safeAreaPaddingBottomStyle}) => (
        <Modal
          isVisible
          type={CONST.MODAL.MODAL_TYPE.BOTTOM_DOCKED}
          onClose={() => {}}
          onDismiss={() => {}}
          innerContainerStyle={{
            boxShadow: 'none',
            borderRadius: 16,
            paddingBottom: 20,
          }}>
          <View style={safeAreaPaddingBottomStyle}>
            <TermsScreenContent
              title={translate('agreeToTerms.title')}
              onAccept={handleAccept}
            />
          </View>
        </Modal>
      )}
    </SafeAreaConsumer>
  );
}

TermsReConsentGuard.displayName = 'TermsReConsentGuard';

export default TermsReConsentGuard;
