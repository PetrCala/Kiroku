// TODO this is a placeholder file for now
// import React from 'react';
// import {withOnyx} from 'react-native-onyx';
// import HeaderWithBackButton from '@components/HeaderWithBackButton';
// import ScreenWrapper from '@components/ScreenWrapper';
// import SelectionList from '@components/SelectionList';
// import RadioListItem from '@components/SelectionList/RadioListItem';
// import Text from '@components/Text';
// import useLocalize from '@hooks/useLocalize';
// import useThemeStyles from '@hooks/useThemeStyles';
// import Navigation from '@libs/Navigation/Navigation';
// import * as User from '@userActions/User';
// import CONST from '@src/CONST';
// import ONYXKEYS from '@src/ONYXKEYS';
// import type {PreferredTheme} from '@src/types/onyx';

// type ThemeScreenOnyxProps = {
//   /** The theme of the app */
//   preferredTheme: PreferredTheme;
// };

// type ThemeScreenProps = ThemeScreenOnyxProps;

// function ThemeScreen({preferredTheme}: ThemeScreenProps) {
//   const styles = useThemeStyles();
//   const {translate} = useLocalize();
//   const {DEFAULT, FALLBACK, ...themes} = CONST.THEME;
//   const localesToThemes = Object.values(themes).map(theme => ({
//     value: theme,
//     text: translate(`themePage.themes.${theme}.label`),
//     keyForList: theme,
//     isSelected: (preferredTheme ?? CONST.THEME.DEFAULT) === theme,
//   }));

//   return (
//     <ScreenWrapper
//       includeSafeAreaPaddingBottom={false}
//       testID={ThemeScreen.displayName}>
//       <HeaderWithBackButton
//         title={translate('themePage.theme')}
//         shouldShowBackButton
//         onBackButtonPress={() => Navigation.goBack()}
//         onCloseButtonPress={() => Navigation.dismissModal()}
//       />

//       <Text style={[styles.mh5, styles.mv4]}>
//         {translate('themePage.chooseThemeBelowOrSync')}
//       </Text>

//       <SelectionList
//         sections={[{data: localesToThemes}]}
//         ListItem={RadioListItem}
//         onSelectRow={theme => User.updateTheme(theme.value)}
//         initiallyFocusedOptionKey={
//           localesToThemes.find(theme => theme.isSelected)?.keyForList
//         }
//       />
//     </ScreenWrapper>
//   );
// }

// ThemeScreen.displayName = 'ThemeScreen';

// export default withOnyx<ThemeScreenProps, ThemeScreenOnyxProps>({
//   preferredTheme: {
//     key: ONYXKEYS.PREFERRED_THEME,
//   },
// })(ThemeScreen);
