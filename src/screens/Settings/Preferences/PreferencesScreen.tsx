import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  BackHandler,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useUserConnection} from '@context/global/UserConnectionContext';
import {useFirebase} from '@context/global/FirebaseContext';
import UserOffline from '@components/UserOffline';
import BasicButton from '@components/Buttons/BasicButton';
import {savePreferencesData} from '@database/preferences';
import YesNoPopup from '@components/Popups/YesNoPopup';
import TextSwitch from '@components/TextSwitch';
import NumericSlider from '@components/Popups/NumericSlider';
import {getDefaultPreferences} from '@database/users';
import type {Preferences} from '@src/types/onyx';
import CONST from '@src/CONST';
import {useDatabaseData} from '@context/global/DatabaseDataContext';
import type {StackScreenProps} from '@react-navigation/stack';
import type {SettingsNavigatorParamList} from '@libs/Navigation/types';
import type SCREENS from '@src/SCREENS';
import Navigation from '@libs/Navigation/Navigation';
import ROUTES from '@src/ROUTES';
import {isEqual} from 'lodash';
import ScreenWrapper from '@components/ScreenWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import useLocalize from '@hooks/useLocalize';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';

type PreferencesListProps = {
  id: string;
  initialContents: Array<{key: string; label: string; value: string}>;
  onButtonPress: (key: string, label: string, value: number) => void;
};

const PreferencesList: React.FC<PreferencesListProps> = ({
  id,
  initialContents,
  onButtonPress,
}) => {
  return (
    <View style={styles.preferencesListContainer}>
      {initialContents.map((item, index) => {
        const itemValue = parseFloat(item.value);

        return (
          <View key={index} style={styles.preferencesListRowContainer}>
            <Text style={styles.preferencesListLabel}>{item.label}</Text>
            {/* <View style={styles.preferencesListUseContainer}>
            </View> */}
            <View style={styles.preferencesListNumericContainer}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.preferencesListButton}
                onPress={() => onButtonPress(item.key, item.label, itemValue)}>
                <Text style={styles.preferencesListText}>{itemValue}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
};

type PreferencesScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.PREFERENCES.ROOT
>;

function PreferencesScreen({route}: PreferencesScreenProps) {
  const {auth, db} = useFirebase();
  const user = auth.currentUser;
  const {translate} = useLocalize();
  const {isOnline} = useUserConnection();
  const {preferences} = useDatabaseData();
  const initialPreferences = useRef(preferences);
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
  const [sliderVisible, setSliderVisible] = useState<boolean>(false);
  const [sliderStep, setSliderStep] = useState<number>(1);
  const [sliderMaxValue, setSliderMaxValue] = useState<number>(5);
  const [sliderValue, setSliderValue] = useState<number>(0);
  const [sliderHeading, setSliderHeading] = useState<string>('');
  const [sliderList, setSliderList] = useState<string>('');
  const [sliderKey, setSliderKey] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  // Deconstruct the preferences
  const defaultPreferences = getDefaultPreferences();
  const [currentPreferences, setCurrentPreferences] = useState<Preferences>(
    preferences || defaultPreferences,
  );

  const havePreferencesChanged = () => {
    return !isEqual(initialPreferences.current, currentPreferences);
  };

  const handleGoBack = () => {
    if (havePreferencesChanged()) {
      setShowLeaveConfirmation(true); // Unsaved changes
    } else {
      Navigation.goBack();
    }
  };

  const handleSavePreferences = async () => {
    if (!user) {
      return;
    }
    try {
      setSaving(true);
      await savePreferencesData(db, user.uid, currentPreferences);
      Navigation.navigate(ROUTES.SETTINGS);
      setSaving(false);
    } catch (error: any) {
      Alert.alert('Preferences saving failed', error.message);
    }
  };

  const handleFirstDayOfWeekToggle = (value: boolean) => {
    const newValue = value ? 'Monday' : 'Sunday';
    setCurrentPreferences(prev => ({...prev, first_day_of_week: newValue}));
  };

  const updateUnitsToColors = (colorKey: string, value: number) => {
    // const updateUnitsToColors = (colorKey: keyof UnitsToColorsData, value: number) => {
    setCurrentPreferences(prev => ({
      ...prev,
      units_to_colors: {
        ...prev.units_to_colors,
        [colorKey]: value,
      },
    }));
  };

  // const updateDrinksToUnits = (DrinkKey: typeof DrinkTypesKeys[number], value: number) => {
  const updateDrinksToUnits = (DrinkKey: string, value: number) => {
    setCurrentPreferences(prev => ({
      ...prev,
      drinks_to_units: {
        ...prev.drinks_to_units,
        [DrinkKey]: value,
      },
    }));
  };

  useMemo(() => {
    if (!preferences) {
      return;
    }
    const newPreferences = {
      first_day_of_week: preferences.first_day_of_week,
      units_to_colors: preferences.units_to_colors,
      drinks_to_units: preferences.drinks_to_units,
    };
    if (JSON.stringify(newPreferences) !== JSON.stringify(preferences)) {
      setCurrentPreferences(newPreferences);
    }
  }, [preferences]);

  // Make the system back press toggle the go back handler
  useEffect(() => {
    const backAction = () => {
      handleGoBack();
      return true; // Prevent the event from bubbling up and being handled by the default handler
    };

    BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => {
      BackHandler.removeEventListener('hardwareBackPress', backAction);
    };
  }, [currentPreferences]); // Add your state dependencies here

  if (!isOnline) {
    return <UserOffline />;
  }
  if (!user || !preferences) {
    Navigation.navigate(ROUTES.LOGIN);
    return null;
  }
  if (saving) {
    return (
      <FullScreenLoadingIndicator loadingText="Saving your preferences..." />
    );
  }

  return (
    <ScreenWrapper testID={PreferencesScreen.displayName}>
      <HeaderWithBackButton
        title={translate('preferencesScreen.title')}
        onBackButtonPress={handleGoBack}
      />
      <ScrollView
        style={styles.scrollView}
        onScrollBeginDrag={Keyboard.dismiss}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.container, styles.horizontalContainer]}>
          <Text style={styles.label}>First Day of Week</Text>
          <View style={styles.itemContainer}>
            <TextSwitch
              offText="Sun"
              onText="Mon"
              value={currentPreferences.first_day_of_week === 'Monday'}
              onValueChange={handleFirstDayOfWeekToggle}
            />
          </View>
        </View>
        <View style={[styles.container, styles.verticalContainer]}>
          <Text style={styles.label}>Unit Colors</Text>
          <View style={styles.itemContainer}>
            <PreferencesList
              id="units_to_colors"
              initialContents={[
                {
                  key: 'yellow',
                  label: 'Yellow',
                  value: currentPreferences.units_to_colors.yellow.toString(),
                },
                {
                  key: 'orange',
                  label: 'Orange',
                  value: currentPreferences.units_to_colors.orange.toString(),
                },
              ]}
              onButtonPress={(key, label, value) => {
                setSliderHeading(label);
                setSliderStep(1);
                setSliderMaxValue(15);
                setSliderValue(value);
                setSliderVisible(true);
                setSliderList('units_to_colors');
                setSliderKey(key);
              }}
            />
          </View>
        </View>
        <View style={[styles.container, styles.verticalContainer]}>
          <Text style={styles.label}>Drinks to Units Conversion</Text>
          <View style={styles.itemContainer}>
            <PreferencesList
              id="drinks_to_units" // Another unique identifier
              initialContents={Object.values(CONST.DRINKS.KEYS).map(
                (key, index) => ({
                  key: key,
                  label: Object.values(CONST.DRINKS.NAMES)[index],
                  value: currentPreferences.drinks_to_units[key].toString(), // Non-null assertion
                }),
              )}
              onButtonPress={(key, label, value) => {
                setSliderHeading(label);
                setSliderStep(0.1);
                setSliderMaxValue(3);
                setSliderValue(value);
                setSliderVisible(true);
                setSliderList('drinks_to_units');
                setSliderKey(key);
              }}
            />
          </View>
        </View>
        {/* <View style={[styles.container, styles.horizontalContainer]}>
          <Text style={styles.label}>
            Automatically order drinks in session window
          </Text>
          <View style={styles.itemContainer}>
            <Text>hello</Text>
          </View>
        </View> */}
      </ScrollView>
      <NumericSlider
        visible={sliderVisible}
        transparent={true}
        value={sliderValue}
        heading={sliderHeading}
        step={sliderStep}
        maxValue={sliderMaxValue}
        onRequestClose={() => {
          setSliderVisible(false);
          setSliderValue(0);
          setSliderHeading('');
        }}
        onSave={newValue => {
          if (sliderList == 'units_to_colors') {
            updateUnitsToColors(sliderKey, newValue);
          } else if (sliderList == 'drinks_to_units') {
            updateDrinksToUnits(sliderKey, newValue);
          }
          setSliderVisible(false);
        }}
      />
      <View style={styles.savePreferencesButtonContainer}>
        <BasicButton
          text="Save Preferences"
          buttonStyle={styles.savePreferencesButton}
          textStyle={styles.savePreferencesButtonText}
          onPress={handleSavePreferences}
        />
      </View>
      <YesNoPopup
        visible={showLeaveConfirmation}
        transparent={true}
        onRequestClose={() => setShowLeaveConfirmation(false)}
        message="You have unsaved changes. Are you sure you want to go back?"
        onYes={() => {
          setShowLeaveConfirmation(false);
          Navigation.goBack();
        }}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    width: '100%',
    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: '#FFFF99',
  },
  container: {
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    margin: 2,
  },
  horizontalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verticalContainer: {
    flexDirection: 'column',
  },
  label: {
    color: 'black',
    fontSize: 16,
    fontWeight: 'bold',
    width: 'auto',
    maxWidth: '75%',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    borderRadius: 5,
    padding: 5,
    margin: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  preferencesListContainer: {
    flexDirection: 'column',
    width: '100%',
  },
  preferencesListRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    // backgroundColor: 'pink',
  },
  preferencesListLabel: {
    fontSize: 16,
    color: 'black',
    fontWeight: '400',
    marginLeft: 5,
  },
  preferencesListNumericContainer: {
    height: 35,
    width: 60,
    borderRadius: 5,
    margin: 8,
    color: 'black',
  },
  preferencesListButton: {
    height: 40,
    width: 60,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#FFFF99',
    justifyContent: 'center',
  },
  preferencesListText: {
    fontSize: 16,
    color: 'black',
    fontWeight: '500',
    textAlign: 'center',
  },
  savePreferencesButtonContainer: {
    width: '100%',
    height: 70,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#FFFF99',
    padding: 5,
  },
  savePreferencesButton: {
    width: '50%',
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#fcf50f',
    // backgroundColor: 'white',
    borderWidth: 2,
    borderColor: 'black',
    borderRadius: 8,
  },
  savePreferencesButtonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

PreferencesScreen.displayName = 'Preferences Screen';
export default PreferencesScreen;
