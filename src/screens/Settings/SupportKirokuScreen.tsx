import React, {useCallback, useEffect, useState} from 'react';
import {View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import type {PurchasesOffering, PurchasesPackage} from 'react-native-purchases';
import Button from '@components/Button';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
import SupporterBadge from '@components/SupporterBadge';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {
  fetchCurrentOffering,
  purchaseSupporterPackage,
  restoreSupporterPurchases,
} from '@libs/actions/Subscriptions';
import Navigation from '@libs/Navigation/Navigation';
import SupporterUtils from '@libs/SupporterUtils';
import * as UserUtils from '@libs/UserUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';

type ViewState =
  | {kind: 'loading'}
  | {kind: 'unavailable'}
  | {kind: 'paywall'; pkg: PurchasesPackage; offering: PurchasesOffering}
  | {kind: 'purchase-error'; pkg: PurchasesPackage; message: string}
  | {kind: 'purchase-success'}
  | {kind: 'restore-empty'};

function SupportKirokuScreen() {
  const styles = useThemeStyles();
  const {translate} = useLocalize();
  const [privateData] = useOnyx(ONYXKEYS.USER_PRIVATE_DATA);
  const supporter = UserUtils.getCurrentUserSupporterStatus(privateData);

  const [state, setState] = useState<ViewState>({kind: 'loading'});
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Defense-in-depth: even though the Settings menu entry is removed in
  // production builds (see `SupporterUtils.isSupporterTierVisible`), bounce
  // back if the screen is reached via deep link, stale navigation state, or a
  // future entry point that forgets the gate.
  const isVisible = SupporterUtils.isSupporterTierVisible();
  useEffect(() => {
    if (!isVisible) {
      Navigation.goBack(ROUTES.SETTINGS);
    }
  }, [isVisible]);

  // Already-supporter UIs don't load offerings — there's nothing to sell.
  const shouldLoadOfferings = isVisible && !supporter.is_supporter;

  const loadOffering = useCallback(async () => {
    const offering = await fetchCurrentOffering();
    const pkg = offering?.monthly ?? null;
    if (!offering || !pkg) {
      setState({kind: 'unavailable'});
      return;
    }
    setState({kind: 'paywall', pkg, offering});
  }, []);

  useEffect(() => {
    if (!shouldLoadOfferings) {
      return;
    }
    (async () => {
      await loadOffering();
    })();
  }, [shouldLoadOfferings, loadOffering]);

  const retryLoadOffering = useCallback(() => {
    (async () => {
      setState({kind: 'loading'});
      await loadOffering();
    })();
  }, [loadOffering]);

  const handlePurchase = useCallback((pkg: PurchasesPackage) => {
    (async () => {
      setIsPurchasing(true);
      const result = await purchaseSupporterPackage(pkg);
      setIsPurchasing(false);
      if (result.status === 'success') {
        setState({kind: 'purchase-success'});
        return;
      }
      if (result.status === 'cancelled') {
        return;
      }
      setState({kind: 'purchase-error', pkg, message: result.message});
    })();
  }, []);

  const handleRestore = useCallback(() => {
    (async () => {
      setIsRestoring(true);
      const result = await restoreSupporterPurchases();
      setIsRestoring(false);
      if (result.status === 'success' && result.granted) {
        setState({kind: 'purchase-success'});
        return;
      }
      if (result.status === 'success' && !result.granted) {
        setState({kind: 'restore-empty'});
      }
    })();
  }, []);

  const renderLegalFooter = () => (
    <View style={[styles.mt5]}>
      <Text style={[styles.textLabelSupporting, styles.mb2]}>
        {translate('supporter.paywallScreen.autoRenewalNotice')}
      </Text>
      <View style={[styles.flexRow, styles.flexWrap]}>
        <Text
          style={[styles.link, styles.mr3]}
          onPress={() =>
            Navigation.navigate(ROUTES.SETTINGS_SUBSCRIPTION_TERMS)
          }>
          {translate('common.subscriptionTerms')}
        </Text>
        <Text
          style={[styles.link, styles.mr3]}
          onPress={() => Navigation.navigate(ROUTES.SETTINGS_TERMS_OF_SERVICE)}>
          {translate('common.termsOfService')}
        </Text>
        <Text
          style={styles.link}
          onPress={() => Navigation.navigate(ROUTES.SETTINGS_PRIVACY_POLICY)}>
          {translate('common.privacyPolicy')}
        </Text>
      </View>
    </View>
  );

  const renderBenefit = () => (
    <View style={[styles.flexRow, styles.alignItemsCenter, styles.mt3]}>
      <SupporterBadge isSupporter size="medium" />
      <Text style={[styles.ml3, styles.textNormal]}>
        {translate('supporter.benefit')}
      </Text>
    </View>
  );

  const renderBody = () => {
    if (supporter.is_supporter) {
      return (
        <Section
          title={translate('supporter.paywallScreen.thanksTitle')}
          subtitle={translate('supporter.paywallScreen.thanksSubtitle')}
          isCentralPane
          subtitleMuted
          titleStyles={styles.accountSettingsSectionTitle}>
          {renderBenefit()}
          <View style={[styles.mt5]}>
            <Button
              text={translate('supporter.paywallScreen.manageSubscriptionLink')}
              onPress={() =>
                Navigation.navigate(ROUTES.SETTINGS_MANAGE_SUBSCRIPTION)
              }
            />
          </View>
        </Section>
      );
    }

    if (state.kind === 'loading') {
      return (
        <FlexibleLoadingIndicator
          text={translate('supporter.paywallScreen.loading')}
        />
      );
    }

    if (state.kind === 'unavailable') {
      return (
        <Section
          title={translate('supporter.paywallScreen.unavailableTitle')}
          subtitle={translate('supporter.paywallScreen.unavailableSubtitle')}
          isCentralPane
          subtitleMuted
          titleStyles={styles.accountSettingsSectionTitle}>
          <View style={[styles.mt5]}>
            <Button
              text={translate('supporter.paywallScreen.retry')}
              onPress={retryLoadOffering}
            />
          </View>
        </Section>
      );
    }

    if (state.kind === 'purchase-success') {
      return (
        <Section
          title={translate('supporter.paywallScreen.thanksTitle')}
          subtitle={translate('supporter.paywallScreen.thanksSubtitle')}
          isCentralPane
          subtitleMuted
          titleStyles={styles.accountSettingsSectionTitle}>
          {renderBenefit()}
        </Section>
      );
    }

    if (state.kind === 'restore-empty') {
      return (
        <Section
          title={translate('supporter.paywallScreen.title')}
          subtitle={translate('supporter.paywallScreen.restoreEmpty')}
          isCentralPane
          subtitleMuted
          titleStyles={styles.accountSettingsSectionTitle}>
          <View style={[styles.mt5]}>
            <Button
              text={translate('supporter.paywallScreen.retry')}
              onPress={retryLoadOffering}
            />
          </View>
        </Section>
      );
    }

    const pkg =
      state.kind === 'paywall' || state.kind === 'purchase-error'
        ? state.pkg
        : null;
    if (!pkg) {
      return null;
    }
    const priceString = pkg.product.priceString;

    return (
      <Section
        title={translate('supporter.paywallScreen.title')}
        subtitle={translate('supporter.description')}
        isCentralPane
        subtitleMuted
        titleStyles={styles.accountSettingsSectionTitle}>
        {renderBenefit()}
        {state.kind === 'purchase-error' ? (
          <Text style={[styles.mt5, styles.formError]}>
            {translate('supporter.paywallScreen.purchaseError', {
              message: state.message,
            })}
          </Text>
        ) : null}
        <View style={[styles.mt5]}>
          <Button
            success
            large
            isLoading={isPurchasing}
            isDisabled={isPurchasing || isRestoring}
            text={translate('supporter.paywallScreen.purchaseCta', {
              price: priceString,
            })}
            onPress={() => handlePurchase(pkg)}
          />
        </View>
        <View style={[styles.mt3]}>
          <Button
            link
            isLoading={isRestoring}
            isDisabled={isPurchasing || isRestoring}
            text={translate('supporter.paywallScreen.restorePurchases')}
            onPress={handleRestore}
          />
        </View>
        {renderLegalFooter()}
      </Section>
    );
  };

  if (!isVisible) {
    return null;
  }

  return (
    <ScreenWrapper testID={SupportKirokuScreen.displayName}>
      <HeaderWithBackButton
        title={translate('supporter.paywallScreen.title')}
        onBackButtonPress={() => Navigation.goBack(ROUTES.SETTINGS)}
      />
      <ScrollView contentContainerStyle={[styles.pt3, styles.ph5, styles.pb5]}>
        {renderBody()}
      </ScrollView>
    </ScreenWrapper>
  );
}

SupportKirokuScreen.displayName = 'SupportKirokuScreen';

export default SupportKirokuScreen;
