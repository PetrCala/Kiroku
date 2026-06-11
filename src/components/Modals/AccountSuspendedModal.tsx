import {View} from 'react-native';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import * as Session from '@libs/actions/Session';
import * as Link from '@libs/actions/Link';
import CONST from '@src/CONST';
import Button from '@components/Button';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import Modal from '@components/Modal';
import {PressableWithFeedback} from '@components/Pressable';
import SafeAreaConsumer from '@components/SafeAreaConsumer';
import Text from '@components/Text';

/**
 * Mandatory "your account has been suspended" lockout. Shown when the signed-in
 * user's own record carries `banned === true` (an admin ban — kiroku-api also
 * disables the Firebase Auth account, but that only bites on the next token
 * refresh; the pushed `banned` flag locks the client out immediately, Kiroku
 * #1238). Like VerifyEmailModal it is an unswipeable, undismissable gate — the
 * only affordance is "Sign out". A "Contact support" link points at the
 * published moderation contact (kiroku.cz/support) for appeals.
 */
function AccountSuspendedModal() {
  const {auth} = useFirebase();
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();

  const onSignOutPress = () => {
    Session.signOut(auth).catch(() => {
      // Best-effort: even if the network sign-out call fails, the modal stays
      // up (the user remains locked out) — nothing else to surface here.
    });
  };

  const onContactSupportPress = () => {
    Link.openExternalLink(CONST.SUPPORT_URL);
  };

  return (
    <SafeAreaConsumer>
      {({safeAreaPaddingBottomStyle}) => (
        <Modal
          isVisible
          type={CONST.MODAL.MODAL_TYPE.CENTERED_UNSWIPEABLE}
          onClose={() => {}}
          innerContainerStyle={{flex: 1, boxShadow: 'none'}}>
          <View
            style={[
              styles.flex1,
              styles.mh4,
              styles.alignItemsCenter,
              safeAreaPaddingBottomStyle.paddingBottom
                ? safeAreaPaddingBottomStyle
                : styles.pb5,
            ]}>
            <View
              style={[
                styles.flexGrow1,
                styles.justifyContentCenter,
                styles.alignItemsCenter,
              ]}>
              <Icon src={KirokuIcons.Lock} fill={theme.danger} large />
              <Text
                textAlign="center"
                style={[styles.textHeadlineH2, styles.mt3]}>
                {translate('accountSuspendedScreen.title')}
              </Text>
              <Text textAlign="center" style={styles.mt3}>
                {translate('accountSuspendedScreen.body')}
              </Text>
            </View>
            <View style={styles.pb1}>
              <Button
                success
                large
                style={styles.mt1}
                text={translate('settingsScreen.signOut')}
                onPress={onSignOutPress}
              />
              <PressableWithFeedback
                style={[styles.mt4, styles.alignItemsCenter]}
                onPress={onContactSupportPress}
                role={CONST.ROLE.BUTTON}
                accessibilityLabel={translate(
                  'accountSuspendedScreen.contactSupport',
                )}>
                <Text style={styles.link}>
                  {translate('accountSuspendedScreen.contactSupport')}
                </Text>
              </PressableWithFeedback>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaConsumer>
  );
}

AccountSuspendedModal.displayName = 'AccountSuspendedModal';
export default AccountSuspendedModal;
