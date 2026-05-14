import appleAuth from '@invertase/react-native-apple-authentication';
import {useEffect} from 'react';
import {useFirebase} from '@context/global/FirebaseContext';
import * as Session from '@userActions/Session';

/**
 * Mounts at the app root on iOS. Listens for Apple credential revocation events
 * (e.g. user removes the app from their Apple ID settings) and signs the user out.
 *
 * This listener is required for App Store compliance when using Sign in with Apple.
 */
function AppleAuthWrapper() {
  const {auth} = useFirebase();

  useEffect(() => {
    if (!appleAuth.isSupported) {
      return;
    }

    const removeListener = appleAuth.onCredentialRevoked(async () => {
      await Session.signOut(auth);
    });

    return () => {
      removeListener();
    };
  }, [auth]);

  return null;
}

export default AppleAuthWrapper;
