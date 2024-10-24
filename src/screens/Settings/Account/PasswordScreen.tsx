// import React, {useCallback} from 'react';
// import {Alert, View} from 'react-native';
// import FullscreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
// import HeaderWithBackButton from '@components/HeaderWithBackButton';
// import ScreenWrapper from '@components/ScreenWrapper';
// import useLocalize from '@hooks/useLocalize';
// import useThemeStyles from '@hooks/useThemeStyles';
// import Navigation from '@libs/Navigation/Navigation';
// import * as ValidationUtils from '@libs/ValidationUtils';
// import type {SettingsNavigatorParamList} from '@libs/Navigation/types';
// import type {FormOnyxValues} from '@src/components/Form/types';
// import ONYXKEYS from '@src/ONYXKEYS';
// import INPUT_IDS from '@src/types/form/EmailForm';
// import FormProvider from '@components/Form/FormProvider';
// import Text from '@components/Text';
// import {Errors} from '@src/types/onyx/OnyxCommon';
// import InputWrapper from '@components/Form/InputWrapper';
// import variables from '@src/styles/variables';
// import CONST from '@src/CONST';
// import TextInput from '@components/TextInput';
// import {StackScreenProps} from '@react-navigation/stack';
// import SCREENS from '@src/SCREENS';
// // import {submitEmail} from '@database/feedback';
// import {useFirebase} from '@context/global/FirebaseContext';

// type EmailScreenOnyxProps = {};

// type EmailScreenProps = EmailScreenOnyxProps &
//   StackScreenProps<SettingsNavigatorParamList, typeof SCREENS.SETTINGS.DELETE>;

// function EmailScreen({}: EmailScreenProps) {
//   const styles = useThemeStyles();
//   const {translate} = useLocalize();
//   const {db, auth} = useFirebase();
//   const userID = auth.currentUser?.uid;

//   const [isLoading, setIsLoading] = React.useState(false);

//   const onSubmit = async (
//     values: FormOnyxValues<typeof ONYXKEYS.FORMS.FEEDBACK_FORM>,
//   ) => {
//     try {
//       setIsLoading(true);
//       await submitEmail(db, userID, values);
//       Navigation.goBack();
//     } catch (error: any) {
//       Alert.alert('Failed to submit feedback', error.message);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const validate = useCallback(
//     (values: FormOnyxValues<typeof ONYXKEYS.FORMS.FEEDBACK_FORM>): Errors => {
//       const errors = ValidationUtils.getFieldRequiredErrors(values, ['text']);
//       return errors;
//     },
//     [translate],
//   );

//   return (
//     <ScreenWrapper
//       includeSafeAreaPaddingBottom={false}
//       testID={EmailScreen.displayName}>
//       <HeaderWithBackButton
//         title={translate('passwordScreen.title')}
//         shouldShowBackButton
//         onBackButtonPress={Navigation.goBack}
//       />
//       {isLoading ? (
//         <FullscreenLoadingIndicator
//           style={[styles.flex1]}
//           loadingText={translate('passwordScreen.sending')}
//         />
//       ) : (
//         <FormProvider
//           formID={ONYXKEYS.FORMS.EMAIL_FORM}
//           validate={validate}
//           onSubmit={onSubmit}
//           submitButtonText={translate('passwordScreen.submit')}
//           style={[styles.flexGrow1, styles.mh5]}>
//           <View style={[styles.flexGrow1]}>
//             <Text>{translate('passwordScreen.prompt')}</Text>
//             <InputWrapper
//               InputComponent={TextInput}
//               inputID={INPUT_IDS.TEXT}
//               autoGrowHeight
//               maxAutoGrowHeight={variables.textInputAutoGrowMaxHeight}
//               label={translate('passwordScreen.enterEmail')}
//               aria-label={translate('passwordScreen.enterEmail')}
//               role={CONST.ROLE.PRESENTATION}
//               maxLength={CONST.DESCRIPTION_LIMIT}
//               spellCheck={false}
//               containerStyles={[styles.mt5]}
//             />
//           </View>
//         </FormProvider>
//       )}
//     </ScreenWrapper>
//   );
// }

// EmailScreen.displayName = 'EmailScreen';

// export default EmailScreen;
