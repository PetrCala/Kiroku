import React from 'react';
import {ActivityIndicator, View} from 'react-native';
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
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import type IconAsset from '@src/types/utils/IconAsset';

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

/** The glassware next to each line of the menu. */
function getTierIcon(id: TipProductId): IconAsset {
  // eslint-disable-next-line default-case
  switch (id) {
    case 'kiroku.tipjar.small_beer':
      return KirokuIcons.Beer;
    case 'kiroku.tipjar.pint':
      return KirokuIcons.Beer;
    case 'kiroku.tipjar.round':
      return KirokuIcons.AlcoholAssortment;
  }
}

type TipJarMenuItemProps = {
  product: TipProduct;
  isPending: boolean;
  isDisabled: boolean;
  onPress: (id: TipProductId) => void;
};

/**
 * One line of the menu: glass, name, a dotted leader, price. The leader is
 * what makes it read as a drinks menu rather than a settings row, and it does
 * the same job a menu's does, carrying the eye from the name to the price.
 */
function TipJarMenuItem({
  product,
  isPending,
  isDisabled,
  onPress,
}: TipJarMenuItemProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const label = translate(getTierLabel(product.id));

  return (
    <PressableWithFeedback
      accessibilityLabel={`${label} ${product.price}`}
      role={CONST.ROLE.BUTTON}
      disabled={isDisabled}
      onPress={() => onPress(product.id)}
      style={styles.tipJarMenuItem}>
      <Icon src={getTierIcon(product.id)} fill={theme.appColor} medium />
      <Text style={styles.tipJarMenuItemName}>{label}</Text>
      <View style={styles.tipJarMenuLeader} />
      {isPending ? (
        <ActivityIndicator
          color={theme.spinner}
          size={CONST.ACTIVITY_INDICATOR_SIZE.SMALL}
        />
      ) : (
        <Text style={styles.tipJarMenuItemPrice}>{product.price}</Text>
      )}
    </PressableWithFeedback>
  );
}

TipJarMenuItem.displayName = 'TipJarMenuItem';

/**
 * The tip jar as a drinks menu: pick a line, it goes on the tab. Three
 * consumable in-app purchases that unlock nothing (see
 * `contributingGuides/TIP_JAR.md`).
 */
function TipJar() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const tipJar = useTipJar();
  const isWeb = getPlatform() === CONST.PLATFORM.WEB;

  const renderMenu = () => {
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

    if (tipJar.status === 'unavailable') {
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
          <TipJarMenuItem
            key={product.id}
            product={product}
            isPending={tipJar.pendingId === product.id}
            isDisabled={!!tipJar.pendingId}
            onPress={tipJar.tip}
          />
        ))}
        {tipJar.purchaseError ? (
          <Text style={[styles.formError, styles.mt3, styles.mb0]}>
            {translate('supporter.tipJar.purchaseError', {
              message: tipJar.purchaseError,
            })}
          </Text>
        ) : null}
      </>
    );
  };

  return (
    <View style={styles.tipJarCard}>
      <View style={styles.tipJarMenuHeader}>
        <Icon src={KirokuIcons.Beer} fill={theme.appColor} large />
        <Text style={[styles.tipJarOverline, styles.mt2]}>
          {translate('supporter.tipJar.menuOverline')}
        </Text>
        <Text style={[styles.tipJarMenuTitle, styles.mt1]}>
          {translate('supporter.tipJar.menuTitle')}
        </Text>
        <Text style={[styles.tipJarMenuSubtitle, styles.mt2]}>
          {translate('supporter.tipJar.subtitle')}
        </Text>
      </View>

      <View style={styles.tipJarMenuList}>{renderMenu()}</View>

      <View style={styles.tipJarNote}>
        <Text style={styles.tipJarNoteText}>
          {translate('supporter.tipJar.makerNote')}
        </Text>
      </View>

      {tipJar.tipsGiven > 0 ? (
        <View style={styles.tipJarStamp}>
          <Icon src={KirokuIcons.Checkmark} fill={theme.appColor} small />
          <Text style={styles.tipJarStampText}>
            {translate('supporter.tipJar.thanksCount', {
              count: tipJar.tipsGiven,
            })}
          </Text>
        </View>
      ) : null}

      <Text style={styles.tipJarFinePrint}>
        {translate('supporter.tipJar.unlocksNothing')}
      </Text>
    </View>
  );
}

TipJar.displayName = 'TipJar';

export default TipJar;
