import React, {useState} from 'react';
import {View} from 'react-native';
import type {ValueOf} from 'type-fest';
import Button from '@components/Button';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {parseFloatAnyLocale, roundToTwoDecimalPlaces} from '@libs/NumberUtils';
import CONST from '@src/CONST';

type Gender = ValueOf<typeof CONST.GENDER>;
type WeightUnit = 'kg' | 'lb';

const KG_PER_LB = 0.45359237;
const LB_PER_KG = 1 / KG_PER_LB;

type BACQuestionnaireProps = {
  /** Currently stored gender, if any (pre-fills the selector when editing). */
  initialGender?: string;

  /** Currently stored weight in kg, if any (pre-fills the input when editing). */
  initialWeightKg?: number;

  /** Called with the chosen gender and the weight normalised to kg. */
  onSubmit: (gender: string, weightKg: number) => void;
};

function BACQuestionnaire({
  initialGender,
  initialWeightKg,
  onSubmit,
}: BACQuestionnaireProps) {
  const styles = useThemeStyles();
  const {translate} = useLocalize();

  const [gender, setGender] = useState<Gender | undefined>(
    initialGender as Gender | undefined,
  );
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [weight, setWeight] = useState<string>(() =>
    initialWeightKg ? String(roundToTwoDecimalPlaces(initialWeightKg)) : '',
  );

  const parsedWeight = parseFloatAnyLocale(weight);
  const isWeightValid = !Number.isNaN(parsedWeight) && parsedWeight > 0;
  const isValid = !!gender && isWeightValid;

  const genderOptions: Array<{value: Gender; label: string}> = [
    {value: CONST.GENDER.MALE, label: translate('achievementsScreen.bac.male')},
    {
      value: CONST.GENDER.FEMALE,
      label: translate('achievementsScreen.bac.female'),
    },
    {
      value: CONST.GENDER.OTHER,
      label: translate('achievementsScreen.bac.other'),
    },
  ];

  const onChangeUnit = (unit: WeightUnit) => {
    if (unit === weightUnit) {
      return;
    }
    if (isWeightValid) {
      const converted =
        unit === 'lb' ? parsedWeight * LB_PER_KG : parsedWeight * KG_PER_LB;
      setWeight(String(roundToTwoDecimalPlaces(converted)));
    }
    setWeightUnit(unit);
  };

  const onSubmitPress = () => {
    if (!gender || !isWeightValid) {
      return;
    }
    const weightKg =
      weightUnit === 'lb' ? parsedWeight * KG_PER_LB : parsedWeight;
    onSubmit(gender, roundToTwoDecimalPlaces(weightKg));
  };

  return (
    <View style={[styles.flex1, styles.ph5, styles.pt4]}>
      <Text style={[styles.mb6]}>
        {translate('achievementsScreen.bac.formIntro')}
      </Text>

      <Text style={[styles.textLabelSupporting, styles.mb2]}>
        {translate('common.gender')}
      </Text>
      <View style={[styles.flexRow, styles.mb6, {gap: 8}]}>
        {genderOptions.map(option => (
          <View key={option.value} style={styles.flex1}>
            <Button
              text={option.label}
              success={gender === option.value}
              onPress={() => setGender(option.value)}
            />
          </View>
        ))}
      </View>

      <Text style={[styles.textLabelSupporting, styles.mb2]}>
        {translate('common.weight')}
      </Text>
      <View style={[styles.flexRow, styles.alignItemsEnd, {gap: 8}]}>
        <View style={styles.flex1}>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            label={translate('common.weight')}
            accessibilityLabel={translate('common.weight')}
            aria-label={translate('common.weight')}
            inputMode="decimal"
          />
        </View>
        <Button
          text={translate('achievementsScreen.bac.kg')}
          success={weightUnit === 'kg'}
          onPress={() => onChangeUnit('kg')}
        />
        <Button
          text={translate('achievementsScreen.bac.lb')}
          success={weightUnit === 'lb'}
          onPress={() => onChangeUnit('lb')}
        />
      </View>

      <Button
        large
        success
        style={[styles.mt6]}
        text={translate('common.save')}
        isDisabled={!isValid}
        onPress={onSubmitPress}
      />
    </View>
  );
}

BACQuestionnaire.displayName = 'BACQuestionnaire';
export default BACQuestionnaire;
