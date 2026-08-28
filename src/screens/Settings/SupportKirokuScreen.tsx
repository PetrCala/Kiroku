import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import type {PurchasesPackage} from 'react-native-purchases';
import Badge from '@components/Badge';
import Button from '@components/Button';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Section from '@components/Section';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useTipJar from '@hooks/useTipJar';
import {
  fetchCurrentOffering,
  purchaseSupporterPackage,
  restoreSupporterPurchases,
} from '@libs/actions/Subscriptions';
import getPlatform from '@libs/getPlatform';
import Navigation from '@libs/Navigation/Navigation';
import SupporterUtils from '@libs/SupporterUtils';
import type {TipProductId} from '@libs/TipJarUtils';
import * as UserUtils from '@libs/UserUtils';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type IconAsset from '@src/types/utils/IconAsset';

/** Predefined RevenueCat package durations the paywall sells. */
type PlanKey = 'annual' | 'monthly';

type Plan = {
  key: PlanKey;
  pkg: PurchasesPackage;
};

type ViewState =
  | {kind: 'loading'}
  | {kind: 'unavailable'}
  | {kind: 'paywall'; plans: Plan[]}
  | {kind: 'purchase-error'; plans: Plan[]; message: string}
  | {kind: 'purchase-success'}
  | {kind: 'restore-empty'};

/**
 * SVG icons for the hero and feature rows. Sourced from the shared
 * `KirokuIcons` set (theme-tinted line icons) rather than emoji, so the screen
 * uses the same icon vocabulary as the rest of the app.
 */
const HERO_ICON = KirokuIcons.Beer;
const FEATURE_BADGE_ICON = KirokuIcons.Beer;
const FEATURE_SUPPORT_ICON = KirokuIcons.Idea;
const FEATURE_EARLY_ACCESS_ICON = KirokuIcons.Star;

/**
 * Tip tier names are the app's own i18n strings, not the store's product
 * names: StoreKit localizes product names by the device's storefront, not by
 * the app's language (see `TipJarUtils`). Exhaustive over `TipProductId`, so
 * adding a product id without a label fails to compile.
 */
function getTipLabel(id: TipProductId): TranslationPaths {
  // No default on purpose: TypeScript's return-type check then forces a case
  // for every TipProductId, which is the compile-time guarantee we want.
  // eslint-disable-next-line default-case
  switch (id) {
    case 'kiroku.tip.small_beer':
      return 'supporter.tipJar.tierSmallBeer';
    case 'kiroku.tip.pint':
      return 'supporter.tipJar.tierPint';
    case 'kiroku.tip.round':
      return 'supporter.tipJar.tierRound';
  }
}

function SupportKirokuScreen() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const [privateData] = useOnyx(ONYXKEYS.USER_PRIVATE_DATA);
  const supporter = UserUtils.getCurrentUserSupporterStatus(privateData);

  const [state, setState] = useState<ViewState>({kind: 'loading'});
  const [selectedPlanKey, setSelectedPlanKey] = useState<PlanKey>('annual');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreErrorMessage, setRestoreErrorMessage] = useState<string | null>(
    null,
  );

  // The screen itself is visible in every build (it carries the tip jar); only
  // the supporter-subscription paywall below stays hidden in production until
  // the v1.1 launch (see `SupporterUtils.isSupporterTierVisible`).
  const isPaywallVisible = SupporterUtils.isSupporterTierVisible();

  const tipJar = useTipJar();
  const isWeb = getPlatform() === CONST.PLATFORM.WEB;

  // Already-supporter UIs don't load offerings; there's nothing to sell.
  const shouldLoadOfferings = isPaywallVisible && !supporter.is_supporter;

  const loadOffering = useCallback(async () => {
    const offering = await fetchCurrentOffering();
    if (!offering) {
      setState({kind: 'unavailable'});
      return;
    }
    const plans: Plan[] = [];
    if (offering.annual) {
      plans.push({key: 'annual', pkg: offering.annual});
    }
    if (offering.monthly) {
      plans.push({key: 'monthly', pkg: offering.monthly});
    }
    if (plans.length === 0) {
      setState({kind: 'unavailable'});
      return;
    }
    setState({kind: 'paywall', plans});
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

  const handlePurchase = useCallback((plans: Plan[], pkg: PurchasesPackage) => {
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
      setState({kind: 'purchase-error', plans, message: result.message});
    })();
  }, []);

  const handleRestore = useCallback(() => {
    if (isRestoring) {
      return;
    }
    (async () => {
      setIsRestoring(true);
      setRestoreErrorMessage(null);
      const result = await restoreSupporterPurchases();
      setIsRestoring(false);
      if (result.status === 'error') {
        setRestoreErrorMessage(result.message);
        return;
      }
      if (result.granted) {
        setState({kind: 'purchase-success'});
        return;
      }
      setState({kind: 'restore-empty'});
    })();
  }, [isRestoring]);

  const renderHeroBadge = () => (
    <View style={styles.supporterHeroBadge}>
      <Icon
        src={HERO_ICON}
        fill={theme.textOnBrand}
        width={variables.iconSizeSuperLarge}
        height={variables.iconSizeSuperLarge}
      />
    </View>
  );

  const renderFeature = (
    icon: IconAsset,
    title: string,
    description: string,
  ) => (
    <View
      style={[
        styles.flexRow,
        styles.alignItemsCenter,
        styles.gap3,
        styles.mt4,
      ]}>
      <View style={styles.supporterFeatureIconContainer}>
        <Icon src={icon} fill={theme.appColor} medium />
      </View>
      <View style={styles.flex1}>
        <Text style={styles.textStrong}>{title}</Text>
        <Text style={styles.textLabelSupporting}>{description}</Text>
      </View>
    </View>
  );

  const renderPlanCard = (plan: Plan, isSelected: boolean) => {
    const isAnnual = plan.key === 'annual';
    const {priceString, pricePerMonthString} = plan.pkg.product;
    const title = isAnnual
      ? translate('supporter.paywallScreen.planAnnualTitle')
      : translate('supporter.paywallScreen.planMonthlyTitle');
    const subLabel = isAnnual
      ? translate('supporter.paywallScreen.pricePerMonth', {
          price: pricePerMonthString ?? priceString,
        })
      : translate('supporter.paywallScreen.planMonthlyBilling');
    const priceLabel = isAnnual
      ? translate('supporter.paywallScreen.pricePerYearShort', {
          price: priceString,
        })
      : translate('supporter.paywallScreen.pricePerMonthShort', {
          price: priceString,
        });

    return (
      <PressableWithFeedback
        key={plan.key}
        accessibilityLabel={title}
        role={CONST.ROLE.BUTTON}
        accessibilityState={{checked: isSelected}}
        wrapperStyle={styles.mt3}
        onPress={() => setSelectedPlanKey(plan.key)}
        style={[
          styles.supporterPlanCard,
          isSelected && styles.supporterPlanCardSelected,
        ]}>
        <View
          style={[
            styles.supporterPlanRadioOuter,
            isSelected && styles.supporterPlanRadioOuterSelected,
            styles.mr3,
          ]}>
          {isSelected ? <View style={styles.supporterPlanRadioInner} /> : null}
        </View>
        <View style={styles.flex1}>
          <Text style={styles.textStrong}>{title}</Text>
          <Text style={styles.textLabelSupporting}>{subLabel}</Text>
        </View>
        <Text style={[styles.textStrong, isAnnual && styles.textSuccess]}>
          {priceLabel}
        </Text>
        {isAnnual ? (
          <View style={styles.supporterBestValuePillPosition}>
            <Badge
              success
              text={translate('supporter.paywallScreen.bestValue')}
              textStyles={styles.supporterBadgePillText}
              badgeStyles={styles.supporterBadgePill}
            />
          </View>
        ) : null}
      </PressableWithFeedback>
    );
  };

  const renderFooter = () => (
    <View style={[styles.mt5]}>
      <View
        style={[
          styles.flexRow,
          styles.justifyContentCenter,
          styles.flexWrap,
          styles.gap4,
        ]}>
        <Text style={styles.link} onPress={handleRestore}>
          {translate('supporter.paywallScreen.restorePurchases')}
        </Text>
        <Text
          style={styles.link}
          onPress={() => Navigation.navigate(ROUTES.SETTINGS_PRIVACY_POLICY)}>
          {translate('common.privacyPolicy')}
        </Text>
        <Text
          style={styles.link}
          onPress={() => Navigation.navigate(ROUTES.SETTINGS_TERMS_OF_SERVICE)}>
          {translate('common.termsOfService')}
        </Text>
      </View>
      {restoreErrorMessage ? (
        <Text style={[styles.formError, styles.textAlignCenter, styles.mt3]}>
          {translate('supporter.paywallScreen.restoreError', {
            message: restoreErrorMessage,
          })}
        </Text>
      ) : null}
      <Text
        style={[
          styles.textLabelSupporting,
          styles.textAlignCenter,
          styles.mt3,
        ]}>
        {translate('supporter.paywallScreen.autoRenewalNotice')}
      </Text>
    </View>
  );

  const renderPaywall = (plans: Plan[], errorMessage?: string) => {
    const selectedPlan =
      plans.find(plan => plan.key === selectedPlanKey) ?? plans[0];
    const isAnnualSelected = selectedPlan.key === 'annual';
    const ctaPrice = isAnnualSelected
      ? translate('supporter.paywallScreen.pricePerYear', {
          price: selectedPlan.pkg.product.priceString,
        })
      : translate('supporter.paywallScreen.pricePerMonth', {
          price: selectedPlan.pkg.product.priceString,
        });

    return (
      <View>
        <View style={styles.alignItemsCenter}>
          {renderHeroBadge()}
          <View style={styles.mt2}>
            <Badge
              success
              text={translate('supporter.paywallScreen.heroPill')}
              textStyles={styles.supporterBadgePillText}
              badgeStyles={styles.supporterBadgePill}
            />
          </View>
        </View>
        <Text style={[styles.supporterTitle, styles.mt4]}>
          {translate('supporter.paywallScreen.heroTitle')}
        </Text>
        <Text style={[styles.supporterSubtitle, styles.mt2, styles.ph3]}>
          {translate('supporter.paywallScreen.heroSubtitle')}
        </Text>

        <View style={styles.mt5}>
          {renderFeature(
            FEATURE_BADGE_ICON,
            translate('supporter.paywallScreen.featureBadgeTitle'),
            translate('supporter.paywallScreen.featureBadgeDescription'),
          )}
          {renderFeature(
            FEATURE_SUPPORT_ICON,
            translate('supporter.paywallScreen.featureSupportTitle'),
            translate('supporter.paywallScreen.featureSupportDescription'),
          )}
          {renderFeature(
            FEATURE_EARLY_ACCESS_ICON,
            translate('supporter.paywallScreen.featureEarlyAccessTitle'),
            translate('supporter.paywallScreen.featureEarlyAccessDescription'),
          )}
        </View>

        <View style={styles.mt5}>
          {plans.map(plan =>
            renderPlanCard(plan, selectedPlan.key === plan.key),
          )}
        </View>

        {errorMessage ? (
          <Text style={[styles.mt5, styles.formError]}>
            {translate('supporter.paywallScreen.purchaseError', {
              message: errorMessage,
            })}
          </Text>
        ) : null}

        <View style={styles.mt5}>
          <Button
            success
            large
            isLoading={isPurchasing}
            isDisabled={isPurchasing || isRestoring}
            text={translate('supporter.paywallScreen.startSupportingCta', {
              price: ctaPrice,
            })}
            textStyles={styles.supporterCtaText}
            onPress={() => handlePurchase(plans, selectedPlan.pkg)}
          />
        </View>

        {renderFooter()}
      </View>
    );
  };

  const renderStatusChip = () => {
    const status = supporter.supporter_status;
    if (!status) {
      return null;
    }
    const expiresDate = SupporterUtils.formatSupporterDate(
      supporter.supporter_expires_at,
    );
    let label: string | null = null;
    if (status === 'active') {
      label = translate('supporter.manageSubscription.status.active');
    } else if (status === 'grace_period') {
      label = translate('supporter.manageSubscription.status.gracePeriod');
    } else if (status === 'expired') {
      label = translate('supporter.manageSubscription.status.expired');
    } else if (status === 'cancelled') {
      label = translate('supporter.manageSubscription.status.cancelled', {
        date: expiresDate,
      });
    }
    if (!label) {
      return null;
    }
    return (
      <>
        <View style={[styles.supporterStatusChip, styles.mt4]}>
          <Text style={styles.textStrong}>{label}</Text>
        </View>
        {status === 'active' && expiresDate ? (
          <Text style={[styles.textLabelSupporting, styles.mt2]}>
            {translate('supporter.manageSubscription.renewsOn', {
              date: expiresDate,
            })}
          </Text>
        ) : null}
      </>
    );
  };

  // Celebratory "thank you" surface shared by the already-supporter view and
  // the immediately-after-purchase view (Option A).
  const renderThanks = () => (
    <View style={styles.alignItemsCenter}>
      {renderHeroBadge()}
      <Text style={[styles.supporterTitle, styles.mt4]}>
        {translate('supporter.paywallScreen.thanksTitle')}
      </Text>
      <Text style={[styles.supporterSubtitle, styles.mt2, styles.ph3]}>
        {translate('supporter.paywallScreen.thanksSubtitle')}
      </Text>
      {renderStatusChip()}
      <View style={[styles.mt5, styles.alignSelfStretch]}>
        <Button
          text={translate('supporter.paywallScreen.manageSubscriptionLink')}
          onPress={() =>
            Navigation.navigate(ROUTES.SETTINGS_MANAGE_SUBSCRIPTION)
          }
        />
      </View>
    </View>
  );

  const renderTipJarContent = () => {
    if (isWeb) {
      return (
        <Text style={[styles.textLabelSupporting, styles.mt2]}>
          {translate('supporter.tipJar.webUnavailable')}
        </Text>
      );
    }
    if (tipJar.status === 'loading') {
      return (
        <FlexibleLoadingIndicator
          style={styles.mt5}
          text={translate('supporter.tipJar.loading')}
        />
      );
    }
    if (tipJar.status === 'unavailable') {
      return (
        <>
          <Text style={[styles.textLabelSupporting, styles.mt2]}>
            {translate('supporter.tipJar.unavailable')}
          </Text>
          <View style={styles.mt5}>
            <Button
              text={translate('supporter.paywallScreen.retry')}
              onPress={tipJar.retry}
            />
          </View>
        </>
      );
    }
    return (
      <>
        {tipJar.products.map(product => {
          const isPending = tipJar.pendingId === product.id;
          return (
            <PressableWithFeedback
              key={product.id}
              accessibilityLabel={translate(getTipLabel(product.id))}
              role={CONST.ROLE.BUTTON}
              disabled={!!tipJar.pendingId}
              wrapperStyle={styles.mt3}
              onPress={() => tipJar.tip(product.id)}
              style={styles.supporterPlanCard}>
              <Text style={[styles.textStrong, styles.flex1]}>
                {translate(getTipLabel(product.id))}
              </Text>
              {isPending ? (
                <ActivityIndicator
                  color={theme.spinner}
                  size={CONST.ACTIVITY_INDICATOR_SIZE.SMALL}
                />
              ) : (
                <Text style={styles.textStrong}>{product.price}</Text>
              )}
            </PressableWithFeedback>
          );
        })}
        {tipJar.purchaseError ? (
          <Text style={[styles.mt3, styles.formError]}>
            {translate('supporter.tipJar.purchaseError', {
              message: tipJar.purchaseError,
            })}
          </Text>
        ) : null}
        {tipJar.tipsGiven > 0 ? (
          <Text style={[styles.textStrong, styles.mt4]}>
            {translate('supporter.tipJar.thanks')}
          </Text>
        ) : null}
        <Text style={[styles.textLabelSupporting, styles.mt4]}>
          {translate('supporter.tipJar.unlocksNothing')}
        </Text>
      </>
    );
  };

  const renderTipJarSection = () => (
    <Section
      title={translate('supporter.tipJar.title')}
      subtitle={translate('supporter.tipJar.subtitle')}
      isCentralPane
      subtitleMuted
      childrenStyles={styles.pt3}
      titleStyles={styles.generalSectionTitle}>
      {renderTipJarContent()}
    </Section>
  );

  const renderBody = () => {
    if (supporter.is_supporter || state.kind === 'purchase-success') {
      return renderThanks();
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

    if (state.kind === 'purchase-error') {
      return renderPaywall(state.plans, state.message);
    }

    return renderPaywall(state.plans);
  };

  return (
    <ScreenWrapper testID={SupportKirokuScreen.displayName}>
      <HeaderWithBackButton
        title={translate('supporter.paywallScreen.title')}
        onBackButtonPress={() => Navigation.goBack()}
      />
      <ScrollView contentContainerStyle={[styles.pt3, styles.pb5]}>
        {isPaywallVisible ? (
          <View style={styles.ph5}>{renderBody()}</View>
        ) : null}
        {renderTipJarSection()}
      </ScrollView>
    </ScreenWrapper>
  );
}

SupportKirokuScreen.displayName = 'SupportKirokuScreen';

export default SupportKirokuScreen;
