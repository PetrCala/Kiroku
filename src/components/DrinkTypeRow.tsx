import React, {useState} from 'react';
import {LayoutAnimation, TextInput, View} from 'react-native';
import type {DrinkingSession, DrinkKey} from '@src/types/onyx';
import useThemeStyles from '@hooks/useThemeStyles';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import * as DS from '@userActions/DrinkingSession';
import type {DrinkOverrides} from '@libs/DrinkEntryUtils';
import {findDrinkNameTranslationKey} from '@libs/DataHandling';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import CONST from '@src/CONST';
import type IconAsset from '@src/types/utils/IconAsset';
import * as KirokuIcons from './Icon/KirokuIcons';
import Icon from './Icon';
import SessionDrinksInputWindow from './Buttons/SessionDrinksInputWindow';
import Button from './Button';
import Text from './Text';

type DrinkTypeRowProps = {
  /** The session this row belongs to */
  session: DrinkingSession;

  /** The drink type rendered by this row */
  drink: {key: DrinkKey; icon: IconAsset};
};

function DrinkTypeRow({session, drink}: DrinkTypeRowProps) {
  const {translate} = useLocalize();
  const {preferences} = useDatabaseData();
  const styles = useThemeStyles();
  const theme = useTheme();

  const drinkKey = drink.key;
  const defaults = CONST.DRINK_DEFAULTS[drinkKey];
  const drinkName = translate(findDrinkNameTranslationKey(drinkKey));
  const iconSize = drinkKey === CONST.DRINKS.KEYS.SMALL_BEER ? 22 : 28;

  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [volumeMl, setVolumeMl] = useState<string>(() => String(defaults.ml));
  const [abvPercent, setAbvPercent] = useState<string>(() =>
    String(Math.round(defaults.abv * 100)),
  );

  const parsedVolume = volumeMl.trim() === '' ? null : parseFloat(volumeMl);
  const parsedAbv = abvPercent.trim() === '' ? null : parseFloat(abvPercent);

  const volumeError =
    parsedVolume !== null && (Number.isNaN(parsedVolume) || parsedVolume <= 0);
  const abvError =
    parsedAbv !== null &&
    (Number.isNaN(parsedAbv) || parsedAbv <= 0 || parsedAbv > 100);

  const isAddDisabled = isAdjustOpen && (volumeError || abvError);

  const toggleAdjust = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsAdjustOpen(prev => {
      const next = !prev;
      if (next) {
        setVolumeMl(String(defaults.ml));
        setAbvPercent(String(Math.round(defaults.abv * 100)));
      }
      return next;
    });
  };

  const buildOverrides = (): DrinkOverrides | undefined => {
    if (!isAdjustOpen) {
      return undefined;
    }
    const effectiveVolume = parsedVolume ?? defaults.ml;
    const effectiveAbvFraction =
      parsedAbv === null ? defaults.abv : parsedAbv / 100;
    const overrides: DrinkOverrides = {};
    if (effectiveVolume !== defaults.ml) {
      overrides.volume_ml = effectiveVolume;
    }
    if (effectiveAbvFraction !== defaults.abv) {
      overrides.abv = effectiveAbvFraction;
    }
    return Object.keys(overrides).length > 0 ? overrides : undefined;
  };

  const handleAdd = () => {
    if (isAddDisabled) {
      return;
    }
    DS.updateDrinks(
      session?.id,
      drinkKey,
      1,
      CONST.DRINKS.ACTIONS.ADD,
      preferences?.drinks_to_units,
      buildOverrides(),
    );
  };

  const handleRemove = () => {
    DS.updateDrinks(
      session?.id,
      drinkKey,
      1,
      CONST.DRINKS.ACTIONS.REMOVE,
      preferences?.drinks_to_units,
    );
  };

  return (
    <View>
      <View
        style={[
          styles.pv1,
          styles.mh3,
          styles.flexRow,
          styles.justifyContentCenter,
          styles.alignItemsCenter,
        ]}>
        <View style={styles.drinkTypesViewIconContainer}>
          <Icon
            fill={theme.text}
            src={drink.icon}
            height={iconSize}
            width={iconSize}
          />
        </View>
        <Text style={[styles.flexGrow1, styles.ml1]}>{drinkName}</Text>
        <Button
          style={[styles.bgTransparent, styles.p1]}
          onPress={handleRemove}
          icon={KirokuIcons.Minus}
          iconFill={theme.text}
        />
        <SessionDrinksInputWindow
          drinks={session?.drinks}
          drinkKey={drinkKey}
          sessionId={session?.id}
        />
        <Button
          style={[styles.bgTransparent, styles.p1]}
          onPress={handleAdd}
          icon={KirokuIcons.Plus}
          iconFill={theme.text}
          isDisabled={isAddDisabled}
        />
      </View>

      <View
        style={[
          styles.flexRow,
          styles.alignItemsCenter,
          styles.mh3,
          styles.pb1,
        ]}>
        <View style={styles.flexGrow1} />
        <Button
          small
          style={[styles.bgTransparent]}
          onPress={toggleAdjust}
          text={translate('drinks.adjust')}
          textStyles={[styles.textSupporting, styles.fontSizeLabel]}
          iconRight={KirokuIcons.ArrowDown}
          iconFill={theme.textSupporting}
          iconRightStyles={
            isAdjustOpen ? {transform: [{rotate: '180deg'}]} : undefined
          }
        />
      </View>

      {isAdjustOpen ? (
        <View
          style={[
            styles.mh3,
            styles.pb2,
            styles.flexRow,
            styles.alignItemsStart,
            styles.justifyContentBetween,
          ]}>
          <View style={[styles.flex1, styles.mr2]}>
            <Text style={[styles.textLabel, styles.textSupporting]}>
              {`${translate('drinks.volumeLabel')} (${translate(
                'drinks.volumeUnit',
              )})`}
            </Text>
            <TextInput
              accessibilityLabel={translate('drinks.volumeLabel')}
              value={volumeMl}
              onChangeText={setVolumeMl}
              keyboardType="numeric"
              style={[
                styles.textInputContainer,
                styles.pv1,
                styles.ph2,
                styles.textPlainColor,
              ]}
            />
            {volumeError ? (
              <Text style={styles.textLabelError}>
                {translate('drinks.adjustErrors.volumeMustBePositive')}
              </Text>
            ) : null}
          </View>
          <View style={styles.flex1}>
            <Text style={[styles.textLabel, styles.textSupporting]}>
              {`${translate('drinks.abvLabel')} (${translate(
                'drinks.abvUnit',
              )})`}
            </Text>
            <TextInput
              accessibilityLabel={translate('drinks.abvLabel')}
              value={abvPercent}
              onChangeText={setAbvPercent}
              keyboardType="numeric"
              style={[
                styles.textInputContainer,
                styles.pv1,
                styles.ph2,
                styles.textPlainColor,
              ]}
            />
            {abvError ? (
              <Text style={styles.textLabelError}>
                {translate('drinks.adjustErrors.abvOutOfRange')}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

DrinkTypeRow.displayName = 'DrinkTypeRow';

export default React.memo(DrinkTypeRow);
export type {DrinkTypeRowProps};
