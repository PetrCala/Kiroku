import React, {useCallback, useMemo} from 'react';
import Modal from '@components/Modal';
import SafeAreaConsumer from '@components/SafeAreaConsumer';
import TermsScreenContent from '@components/TermsScreenContent';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import * as Onboarding from '@userActions/Onboarding';
import {
  hasAcceptedCurrentTerms,
  hasCompletedOnboarding,
} from '@libs/OnboardingSelectors';
import CONST from '@src/CONST';
import {View} from 'react-native';

/**
 * Prompts users who have already completed onboarding but whose accepted
 * Terms & Conditions version is stale. Renders a non-dismissable modal
 * **outside** the onboarding modal navigator so new-account onboarding and
 * post-onboarding re-consent stay independent flows.
 */
function TermsReConsentGuard() {
  const {auth, db} = useFirebase();
  const {translate} = useLocalize();
  const {userData} = useDatabaseData();

  const shouldPrompt = useMemo(() => {
    if (!auth?.currentUser) {
      return false;
    }
    if (userData === undefined) {
      return false;
    }
    if (!hasCompletedOnboarding(userData)) {
      return false;
    }
    return !hasAcceptedCurrentTerms(userData);
  }, [auth?.currentUser, userData]);

  const handleAccept = useCallback(async () => {
    await Onboarding.acceptTerms(db, auth.currentUser);
  }, [auth, db]);

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
