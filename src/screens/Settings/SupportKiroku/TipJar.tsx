import React, {useState} from 'react';
import {View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Button from '@components/Button';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useTipJar from '@hooks/useTipJar';
import getPlatform from '@libs/getPlatform';
import type {TipProduct, TipProductId} from '@libs/TipJarUtils';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import type IconAsset from '@src/types/utils/IconAsset';

/**
 * Tier names and CTA labels are the app's own i18n strings, not the store's
 * product names: StoreKit localizes product names by the device's storefront,
 * not by the app's language (see `TipJarUtils`). Both helpers are exhaustive
 * over `TipProductId`, so adding a product id without copy fails to compile.
 */
function getTierLabel(id: TipProductId): TranslationPaths {
  // No default on purpose: TypeScript's return-type check then forces a case
  // for every TipProductId, which is the compile-time guarantee we want.
  // eslint-disable-next-line default-case
  switch (id) {
    case 'kiroku.tipjar.small_beer':
      return 'supporter.tipJar.tierSmallBeerShort';
    case 'kiroku.tipjar.pint':
      return 'supporter.tipJar.tierPintShort';
    case 'kiroku.tipjar.round':
      return 'supporter.tipJar.tierRoundShort';
  }
}

/**
 * The glass grows with the tier: the ladder is legible before a single price
 * is read, which is the whole point of showing three tiers side by side.
 */
function getTierIcon(id: TipProductId): {icon: IconAsset; size: number} {
  // eslint-disable-next-line default-case
  switch (id) {
    case 'kiroku.tipjar.small_beer':
      return {icon: KirokuIcons.Beer, size: 24};
    case 'kiroku.tipjar.pint':
      return {icon: KirokuIcons.Beer, size: 32};
    case 'kiroku.tipjar.round':
      return {icon: KirokuIcons.AlcoholAssortment, size: 40};
  }
}

/** The tier pre-selected when the screen opens, and the one tagged as popular. */
const DEFAULT_TIER: TipProductId = 'kiroku.tipjar.pint';

type TipJarTierProps = {
  product: TipProduct;
  isSelected: boolean;
  isPopular: boolean;
  isDisabled: boolean;
  onSelect: (id: TipProductId) => void;
};

function TipJarTier({
  product,
  isSelected,
  isPopular,
  isDisabled,
  onSelect,
}: TipJarTierProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {icon, size} = getTierIcon(product.id);
  const label = translate(getTierLabel(product.id));

  return (
    <View style={styles.flex1}>
      <PressableWithFeedback
        accessibilityLabel={`${label} ${product.price}`}
        role={CONST.ROLE.BUTTON}
        accessibilityState={{checked: isSelected}}
        disabled={isDisabled}
        onPress={() => onSelect(product.id)}
        style={[
          styles.tipJarTierCard,
          isSelected && styles.tipJarTierCardSelected,
        ]}>
        <View style={styles.tipJarTierGlass}>
          <Icon
            src={icon}
            width={size}
            height={size}
            fill={isSelected ? theme.appColor : theme.icon}
          />
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.tipJarTierName,
            isSelected && styles.tipJarTierNameSelected,
          ]}>
          {label}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={styles.tipJarTierPrice}>
          {product.price}
        </Text>
      </PressableWithFeedback>
      {isPopular ? (
        <View style={styles.tipJarPopularPill} pointerEvents="none">
          <Text numberOfLines={1} style={styles.tipJarPopularPillText}>
            {translate('supporter.tipJar.mostPopular')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

TipJarTier.displayName = 'TipJarTier';

/**
 * The tip jar: three consumable in-app purchases that unlock nothing (see
 * `contributingGuides/TIP_JAR.md`). The tiers are picked first and bought with
 * one deliberate CTA, so the price a tap will charge is always on screen
 * before the tap happens.
 */
function TipJar() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const tipJar = useTipJar();
  const [selectedId, setSelectedId] = useState<TipProductId>(DEFAULT_TIER);
  const isWeb = getPlatform() === CONST.PLATFORM.WEB;

  // The store decides which tiers come back, so the selection falls back
  // rather than assuming the default tier is among them.
  const selectedProduct =
    tipJar.products.find(product => product.id === selectedId) ??
    tipJar.products.at(0);

  /**
   * A per-tier CTA rather than one string with the tier name interpolated:
   * languages that decline the noun ("Koupit velké pivo") cannot build a
   * grammatical sentence out of a nominative tier name. No default case on
   * purpose, so a new tip product without a CTA fails to compile.
   */
  const getCtaLabel = (product: TipProduct): string => {
    // eslint-disable-next-line default-case
    switch (product.id) {
      case 'kiroku.tipjar.small_beer':
        return translate('supporter.tipJar.ctaSmallBeer', {
          price: product.price,
        });
      case 'kiroku.tipjar.pint':
        return translate('supporter.tipJar.ctaPint', {price: product.price});
      case 'kiroku.tipjar.round':
        return translate('supporter.tipJar.ctaRound', {price: product.price});
    }
  };

  const renderBody = () => {
    if (isWeb) {
      return (
        <Text style={[styles.textLabelSupporting, styles.textAlignCenter]}>
          {translate('supporter.tipJar.webUnavailable')}
        </Text>
      );
    }

    if (tipJar.status === 'loading') {
      return (
        <FlexibleLoadingIndicator
          text={translate('supporter.tipJar.loading')}
        />
      );
    }

    if (tipJar.status === 'unavailable' || !selectedProduct) {
      return (
        <>
          <Text style={[styles.textLabelSupporting, styles.textAlignCenter]}>
            {translate('supporter.tipJar.unavailable')}
          </Text>
          <View style={styles.mt4}>
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
        <View style={[styles.flexRow, styles.gap2]}>
          {tipJar.products.map(product => (
            <TipJarTier
              key={product.id}
              product={product}
              isSelected={product.id === selectedProduct.id}
              isPopular={product.id === DEFAULT_TIER}
              isDisabled={!!tipJar.pendingId}
              onSelect={setSelectedId}
            />
          ))}
        </View>

        {tipJar.purchaseError ? (
          <Text style={[styles.formError, styles.mt4, styles.mb0]}>
            {translate('supporter.tipJar.purchaseError', {
              message: tipJar.purchaseError,
            })}
          </Text>
        ) : null}

        <View style={styles.mt4}>
          <Button
            success
            large
            isLoading={!!tipJar.pendingId}
            isDisabled={!!tipJar.pendingId}
            text={getCtaLabel(selectedProduct)}
            textStyles={styles.tipJarCtaText}
            onPress={() => tipJar.tip(selectedProduct.id)}
          />
        </View>

        <View style={[styles.flexRow, styles.gap2, styles.mt3]}>
          <Icon src={KirokuIcons.Info} fill={theme.icon} small />
          <Text style={[styles.textLabelSupporting, styles.flex1]}>
            {translate('supporter.tipJar.unlocksNothing')}
          </Text>
        </View>
      </>
    );
  };

  return (
    <View style={styles.tipJarCard}>
      <LinearGradient
        colors={[`${theme.appColor}26`, `${theme.appColor}00`]}
        style={styles.tipJarHero}>
        <View style={styles.tipJarHeroGlass}>
          <Icon
            src={KirokuIcons.Beer}
            width={variables.iconSizeExtraLarge}
            height={variables.iconSizeExtraLarge}
            fill={theme.appColor}
          />
        </View>
        <Text style={[styles.tipJarHeroTitle, styles.mt3]}>
          {translate('supporter.tipJar.heroTitle')}
        </Text>
        <Text style={[styles.tipJarHeroSubtitle, styles.mt2]}>
          {translate('supporter.tipJar.subtitle')}
        </Text>
        {tipJar.tipsGiven > 0 ? (
          <View style={[styles.tipJarThanksChip, styles.mt3]}>
            <Icon src={KirokuIcons.Checkmark} fill={theme.appColor} small />
            <Text style={styles.tipJarThanksChipText}>
              {translate('supporter.tipJar.thanksCount', {
                count: tipJar.tipsGiven,
              })}
            </Text>
          </View>
        ) : null}
      </LinearGradient>
      <View style={styles.tipJarBody}>{renderBody()}</View>
    </View>
  );
}

TipJar.displayName = 'TipJar';

export default TipJar;
