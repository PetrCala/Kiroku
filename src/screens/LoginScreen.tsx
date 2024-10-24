import React, {useReducer} from 'react';
import {
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import * as ErrorUtils from '@libs/ErrorUtils';
import {useFocusEffect} from '@react-navigation/native';
import {sendPasswordResetEmail, signOut} from 'firebase/auth';
import {signInUserWithEmailAndPassword} from '@libs/auth/auth';
import commonStyles from '@styles/commonStyles';
import InputTextPopup from '@components/Popups/InputTextPopup';
import WarningMessage from '@components/Info/WarningMessage';
import SuccessMessage from '@components/Info/SuccessMessage';
import DismissKeyboard from '@components/Keyboard/DismissKeyboard';
import ROUTES from '@src/ROUTES';
import Navigation from '@navigation/Navigation';
import {useFirebase} from '@context/global/FirebaseContext';
import ScreenWrapper from '@components/ScreenWrapper';
import useTheme from '@hooks/useTheme';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';

type State = {
  email: string;
  password: string;
  loadingUser: boolean;
  warning: string;
  success: string;
  resetPasswordModalVisible: boolean;
};

type Action = {
  type: string;
  payload: any;
};

const initialState: State = {
  email: '',
  password: '',
  loadingUser: true,
  warning: '',
  success: '',
  resetPasswordModalVisible: false,
};

const reducer = (state: State, action: Action) => {
  switch (action.type) {
    case 'UPDATE_EMAIL':
      return {
        ...state,
        email: action.payload,
      };
    case 'UPDATE_PASSWORD':
      return {
        ...state,
        password: action.payload,
      };
    case 'SET_LOADING_USER':
      return {
        ...state,
        loadingUser: action.payload,
      };
    case 'SET_WARNING':
      return {
        ...state,
        warning: action.payload,
      };
    case 'SET_SUCCESS':
      return {
        ...state,
        success: action.payload,
      };
    case 'SET_RESET_PASSWORD_MODAL_VISIBLE':
      return {
        ...state,
        resetPasswordModalVisible: action.payload,
      };
    default:
      return state;
  }
};

function LoginScreen() {
  // const {isOnline} = useUserConnection();
  const {auth} = useFirebase();
  const [state, dispatch] = useReducer(reducer, initialState);
  const theme = useTheme();

  useFocusEffect(
    // Redirect to main screen if user is already logged in (from login screen only)
    React.useCallback(() => {
      const stopListening = auth.onAuthStateChanged(user => {
        if (user) {
          dispatch({type: 'SET_LOADING_USER', payload: true});
          Navigation.navigate(ROUTES.HOME);
        }
        dispatch({type: 'SET_LOADING_USER', payload: false});
      });

      return () => {
        dispatch({type: 'SET_LOADING_USER', payload: false});
        stopListening(); // This will be called when the screen loses focus
      };
    }, []),
  );

  const handleLogin = async () => {
    // Validate all hooks on the screen first, return null if invalid
    // Attempt to login
    try {
      dispatch({type: 'SET_LOADING_USER', payload: true});
      await signInUserWithEmailAndPassword(auth, state.email, state.password);
    } catch (error: any) {
      const errorMessage = ErrorUtils.getErrorMessage(error);
      dispatch({type: 'SET_WARNING', payload: errorMessage});
    } finally {
      dispatch({type: 'SET_LOADING_USER', payload: false});
    }
    return;
  };

  const handleResetPassword = async (mail: string) => {
    try {
      await sendPasswordResetEmail(auth, mail);
      dispatch({type: 'SET_SUCCESS', payload: 'Password reset link sent'});
    } catch (error: any) {
      const errorMessage = ErrorUtils.getErrorMessage(error);
      dispatch({type: 'SET_WARNING', payload: errorMessage});
    } finally {
      dispatch({type: 'SET_RESET_PASSWORD_MODAL_VISIBLE', payload: false});
    }
  };

  // Wait to see whether there already is an authentificated user
  // Possibly here display the app logo instead of the loading screen
  if (state.loadingUser) {
    return <FullScreenLoadingIndicator loadingText="Signing in..." />;
  }

  return (
    <DismissKeyboard>
      <View style={styles.mainContainer}>
        <WarningMessage warningText={state.warning} dispatch={dispatch} />
        <SuccessMessage successText={state.success} dispatch={dispatch} />
        <View style={styles.logoContainer}>
          <Image source={KirokuIcons.Logo} style={styles.logo} />
        </View>
        <View style={styles.inputContainer}>
          <TextInput
            accessibilityLabel="Text input field"
            placeholder="Email"
            placeholderTextColor={'#a8a8a8'}
            selectionColor={'gray'}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={state.email}
            onChangeText={text =>
              dispatch({type: 'UPDATE_EMAIL', payload: text})
            }
            style={styles.input}
          />
          <TextInput
            accessibilityLabel="Text input field"
            placeholder="Password"
            placeholderTextColor={'#a8a8a8'}
            selectionColor={'gray'}
            textContentType="password"
            value={state.password}
            onChangeText={text =>
              dispatch({type: 'UPDATE_PASSWORD', payload: text})
            }
            secureTextEntry
            style={styles.input}
          />
          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleLogin}
            style={styles.loginButton}>
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() =>
              dispatch({
                type: 'SET_RESET_PASSWORD_MODAL_VISIBLE',
                payload: true,
              })
            }
            style={styles.forgottenPasswordButton}>
            <Text style={styles.forgottenPasswordText}>
              Forgot your password?
            </Text>
          </TouchableOpacity>
          <View style={[commonStyles.horizontalLine, styles.customLineWidth]} />
          <View style={styles.signUpContainer}>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.signUpButtonContainer}
              onPress={() => Navigation.navigate(ROUTES.SIGNUP)}>
              <Text style={styles.signUpInfoText}>Don't have an account?</Text>
              <Text style={styles.signUpButtonText}>Sign up</Text>
            </TouchableOpacity>
          </View>
          <InputTextPopup
            visible={state.resetPasswordModalVisible}
            transparent={true}
            message={'E-mail to send the reset link to:'}
            confirmationMessage={'Send link'}
            placeholder={'E-mail'}
            onRequestClose={() =>
              dispatch({
                type: 'SET_RESET_PASSWORD_MODAL_VISIBLE',
                payload: false,
              })
            }
            onSubmit={mail => handleResetPassword(mail)}
            keyboardType="email-address"
            textContentType="emailAddress"
            secureTextEntry={false}
          />
        </View>
      </View>
    </DismissKeyboard>
  );
}

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'column',
    backgroundColor: '#FFFF99',
  },
  logoContainer: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    height: screenHeight * 0.2,
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  warningInfoContainer: {
    backgroundColor: '#fce3e1',
    borderColor: 'red',
  },
  successInfoContainer: {
    backgroundColor: '#e3f0d5',
    borderColor: 'green',
  },
  infoButton: {
    justifyContent: 'center',
    textAlign: 'center',
    width: '100%',
    height: '100%',
  },
  infoText: {
    textAlign: 'center',
    fontWeight: 'bold',
    padding: 5,
  },
  warningInfoText: {
    color: 'red',
  },
  successInfoText: {
    color: 'green',
  },
  inputContainer: {
    paddingTop: screenHeight * 0.1,
    width: '80%',
    height: screenHeight * 0.85,
  },
  input: {
    backgroundColor: 'white',
    height: 45,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    borderColor: '#000',
    borderWidth: 2,
    marginTop: 5,
    marginBottom: 5,
    color: 'black',
  },
  loginButton: {
    backgroundColor: '#fcf50f',
    width: '100%',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    marginTop: 10,
    borderColor: '#000',
    alignItems: 'center',
    alignSelf: 'center',
  },
  loginButtonText: {
    color: 'black',
    fontWeight: '700',
    fontSize: 16,
  },
  forgottenPasswordButton: {
    width: '100%',
    backgroundColor: '#ffff99',
    textAlign: 'center',
    alignItems: 'center',
    marginTop: 3,
    marginBottom: 3,
    padding: 10,
  },
  forgottenPasswordText: {
    color: '#02a109',
    fontWeight: 'bold',
    fontSize: 14,
  },
  signUpContainer: {
    width: '100%',
    marginTop: 5,
    alignItems: 'center',
    alignSelf: 'center',
  },
  signUpButtonContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpInfoText: {
    color: '#000',
  },
  signUpButtonText: {
    color: '#02a109',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 4,
    paddingTop: 10,
    paddingBottom: 10,
  },
  customLineWidth: {
    width: screenWidth * 0.7,
  },
});

LoginScreen.displayName = 'Login Screen';
export default LoginScreen;
