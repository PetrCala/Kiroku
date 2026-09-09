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

const METER_SEGMENTS = [0, 1, 2];

/**
 * How many of the three meter segments a tier fills. No default case on
 * purpose, so a new tip product without a place in the ladder fails to
 * compile.
 */
function getTierStrength(id: TipProductId): number {
  // eslint-disable-next-line default-case
  switch (id) {
    case 'kiroku.tipjar.small_beer':
      return 1;
    case 'kiroku.tipjar.pint':
      return 2;
    case 'kiroku.tipjar.round':
      return 3;
  }
}

/**
 * Tier names are the app's own i18n strings, not the store's product names:
 * StoreKit localizes product names by the device's storefront, not by the
 * app's language (see `TipJarUtils`). Exhaustive over `TipProductId`, so
 * adding a product id without a label fails to compile.
 */
function getTierLabel(id: TipProductId): TranslationPaths {
  // No default on purpose: TypeScript's return-type check then forces a case
  // for every TipProductId, which is the compile-time guarantee we want.
  // eslint-disable-next-line default-case
  switch (id) {
    case 'kiroku.tipjar.small_beer':
      return 'supporter.tipJar.tierSmallBeer';
    case 'kiroku.tipjar.pint':
      return 'supporter.tipJar.tierPint';
    case 'kiroku.tipjar.round':
      return 'supporter.tipJar.tierRound';
  }
}

/** What a tip pays for. Copy that answers "where does my money go". */
const IMPACTS: Array<{icon: IconAsset; text: TranslationPaths}> = [
  {icon: KirokuIcons.Gear, text: 'supporter.tipJar.impactServers'},
  {icon: KirokuIcons.Checkmark, text: 'supporter.tipJar.impactNoAds'},
  {icon: KirokuIcons.Idea, text: 'supporter.tipJar.impactNext'},
];

/** The tier pre-selected when the screen opens. */
const DEFAULT_TIER: TipProductId = 'kiroku.tipjar.pint';

type TipJarOptionProps = {
  product: TipProduct;
  isSelected: boolean;
  isDisabled: boolean;
  onSelect: (id: TipProductId) => void;
};

/**
 * One full-width tier row: name, a three-segment meter that shows how far up
 * the ladder the tier sits, and the store's own price string.
 */
function TipJarOption({
  product,
  isSelected,
  isDisabled,
  onSelect,
}: TipJarOptionProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const label = translate(getTierLabel(product.id));
  const strength = getTierStrength(product.id);

  return (
    <PressableWithFeedback
      accessibilityLabel={`${label} ${product.price}`}
      role={CONST.ROLE.BUTTON}
      accessibilityState={{checked: isSelected}}
      disabled={isDisabled}
      wrapperStyle={styles.mt3}
      onPress={() => onSelect(product.id)}
      style={[styles.tipJarOption, isSelected && styles.tipJarOptionSelected]}>
      <View style={styles.flex1}>
        <Text style={styles.tipJarOptionName}>{label}</Text>
        <View style={[styles.flexRow, styles.gap1, styles.mt2]}>
          {METER_SEGMENTS.map(segment => (
            <View
              key={segment}
              style={[
                styles.tipJarMeterSegment,
                segment < strength && styles.tipJarMeterSegmentFilled,
              ]}
            />
          ))}
        </View>
      </View>
      <Text style={styles.tipJarOptionPrice}>{product.price}</Text>
      <View
        style={[
          styles.tipJarOptionCheck,
          isSelected && styles.tipJarOptionCheckSelected,
        ]}>
        {isSelected ? (
          <Icon src={KirokuIcons.Checkmark} fill={theme.textOnBrand} small />
        ) : null}
      </View>
    </PressableWithFeedback>
  );
}

TipJarOption.displayName = 'TipJarOption';

/**
 * The tip jar, led by what the money is for rather than by what it buys you:
 * nothing, by design (see `contributingGuides/TIP_JAR.md`). Three consumable
 * in-app purchases, picked first and bought with one CTA that names the price.
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

  const renderOptions = () => {
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
        {tipJar.products.map(product => (
          <TipJarOption
            key={product.id}
            product={product}
            isSelected={product.id === selectedProduct.id}
            isDisabled={!!tipJar.pendingId}
            onSelect={setSelectedId}
          />
        ))}

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
            text={translate('supporter.tipJar.sendCta', {
              price: selectedProduct.price,
            })}
            textStyles={styles.tipJarCtaText}
            onPress={() => tipJar.tip(selectedProduct.id)}
          />
        </View>

        <Text style={[styles.tipJarFinePrint, styles.mt3]}>
          {translate('supporter.tipJar.unlocksNothing')}
        </Text>
      </>
    );
  };

  return (
    <View style={styles.tipJarCard}>
      <LinearGradient
        colors={[theme.appColor, `${theme.appColor}B3`]}
        style={styles.tipJarBanner}>
        <Icon
          src={KirokuIcons.Beer}
          width={variables.iconSizeExtraLarge}
          height={variables.iconSizeExtraLarge}
          fill={theme.textOnBrand}
        />
        <Text style={[styles.tipJarBannerTitle, styles.mt2]}>
          {translate('supporter.tipJar.bannerTitle')}
        </Text>
        <Text style={[styles.tipJarBannerSubtitle, styles.mt1]}>
          {translate('supporter.tipJar.bannerSubtitle')}
        </Text>
        {tipJar.tipsGiven > 0 ? (
          <Text style={[styles.tipJarBannerThanks, styles.mt2]}>
            {translate('supporter.tipJar.thanksCount', {
              count: tipJar.tipsGiven,
            })}
          </Text>
        ) : null}
      </LinearGradient>

      <View style={styles.tipJarBody}>
        <View style={styles.tipJarImpactRow}>
          {IMPACTS.map(impact => (
            <View key={impact.text} style={styles.tipJarImpact}>
              <View style={styles.tipJarImpactIcon}>
                <Icon src={impact.icon} fill={theme.appColor} small />
              </View>
              <Text style={styles.tipJarImpactText}>
                {translate(impact.text)}
              </Text>
            </View>
          ))}
        </View>

        {renderOptions()}
      </View>
    </View>
  );
}

TipJar.displayName = 'TipJar';

export default TipJar;
