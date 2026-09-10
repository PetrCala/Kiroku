import type {StackScreenProps} from '@react-navigation/stack';
import React, {useCallback, useEffect, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';
import Button from '@components/Button';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ProfileImage from '@components/ProfileImage';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import InviteAppDownloadButtons from '@components/Social/InviteAppDownloadButtons';
import Text from '@components/Text';
import {useFirebase} from '@context/global/FirebaseContext';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {getInviteErrorKind, normalizeInviteCode} from '@libs/FriendInviteUtils';
import type {InviteErrorKind} from '@libs/FriendInviteUtils';
import Navigation from '@libs/Navigation/Navigation';
import type {PublicScreensParamList} from '@libs/Navigation/types';
import * as FriendInvite from '@userActions/FriendInvite';
import type {TranslationPaths} from '@src/languages/types';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type {InvitePreview} from '@src/types/onyx';

type AddFriendScreenProps = StackScreenProps<
  PublicScreensParamList,
  typeof SCREENS.ADD_FRIEND
>;

const REDEEM_ERROR_MESSAGES: Record<InviteErrorKind, TranslationPaths> = {
  invalid: 'addFriendScreen.invalid',
  ownInvite: 'addFriendScreen.ownInvite',
  unavailable: 'addFriendScreen.error.couldNotAdd',
  failed: 'addFriendScreen.error.generic',
};

const localStyles = StyleSheet.create({
  content: {
    maxWidth: 420,
  },
});

/**
 * Target of a personal invite link (`add/<code>`), registered in both root
 * stacks. Signed out, it shows who sent the link and offers sign-in (plus the
 * app downloads on web), and stashes the code so `PendingFriendInviteGuard`
 * reopens this screen after sign-in and onboarding. Signed in, it adds the
 * owner as a friend in one tap through the invite redeem endpoint.
 */
function AddFriendScreen({route}: AddFriendScreenProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {auth} = useFirebase();
  const currentUserID = auth?.currentUser?.uid;
  const userData = useCurrentUserData();
  const code = normalizeInviteCode(route.params?.code);

  const [preview, setPreview] = useState<InvitePreview>();
  const [loadError, setLoadError] = useState<InviteErrorKind>();
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<InviteErrorKind>();

  const loadPreview = useCallback(() => {
    if (!code) {
      return;
    }
    FriendInvite.getInvitePreview(code)
      .then(invitePreview => {
        setLoadError(undefined);
        setPreview(invitePreview);
      })
      .catch((error: unknown) => setLoadError(getInviteErrorKind(error)));
  }, [code]);

  const {isOffline} = useNetwork();

  // Runs on open and again when the connection comes back, until a preview
  // has loaded.
  useEffect(() => {
    if (isOffline || preview) {
      return;
    }
    loadPreview();
  }, [isOffline, preview, loadPreview]);

  // Signed out: keep the code through sign-in. Signed in: we're here already.
  useEffect(() => {
    if (!code) {
      return;
    }
    if (currentUserID) {
      FriendInvite.clearPendingInvite();
      return;
    }
    FriendInvite.stashPendingInvite(code);
  }, [code, currentUserID]);

  const retryLoad = () => {
    setLoadError(undefined);
    loadPreview();
  };

  const displayName =
    preview?.profile.display_name ?? translate('common.unknown');

  const addFriend = useCallback(() => {
    if (!code || !preview) {
      return;
    }
    setIsRedeeming(true);
    setRedeemError(undefined);
    FriendInvite.redeemInvite(code, preview.userID)
      .then(friendUserID => {
        Alert.alert(
          translate('addFriendScreen.addedTitle'),
          translate('addFriendScreen.added', {displayName}),
        );
        Navigation.navigate(ROUTES.PROFILE.getRoute(friendUserID));
      })
      .catch((error: unknown) => setRedeemError(getInviteErrorKind(error)))
      .finally(() => setIsRedeeming(false));
  }, [code, preview, displayName, translate]);

  const renderMessage = (message: string) => (
    <Text style={[styles.textNormal, styles.textAlignCenter]}>{message}</Text>
  );

  const renderAction = (
    text: string,
    onPress: () => void,
    isSuccess = false,
  ) => (
    <Button
      success={isSuccess}
      large
      text={text}
      onPress={onPress}
      style={[styles.w100, styles.mt5]}
    />
  );

  const renderInvalid = () => (
    <>
      <Text style={[styles.headerText, styles.textAlignCenter, styles.mb3]}>
        {translate('addFriendScreen.invalidTitle')}
      </Text>
      {renderMessage(translate('addFriendScreen.invalid'))}
    </>
  );

  const renderSignedOut = () => (
    <>
      {renderMessage(translate('addFriendScreen.invitedYou', {displayName}))}
      {renderAction(
        translate('addFriendScreen.signInToAdd'),
        () => Navigation.navigate(ROUTES.AUTH),
        true,
      )}
      <Text
        style={[
          styles.textLabelSupporting,
          styles.textAlignCenter,
          styles.mt2,
        ]}>
        {translate('addFriendScreen.signInHint')}
      </Text>
      <InviteAppDownloadButtons />
    </>
  );

  const renderSignedIn = (ownerID: string) => {
    if (ownerID === currentUserID) {
      return (
        <>
          {renderMessage(translate('addFriendScreen.ownInvite'))}
          {renderAction(translate('addFriendScreen.showMyQrCode'), () =>
            Navigation.navigate(ROUTES.SOCIAL_MY_QR_CODE),
          )}
        </>
      );
    }
    // Only the user's own outbound blocks are known here; a block the other
    // way surfaces as the neutral "couldn't add" error from redeem.
    if (userData?.blocked?.[ownerID]) {
      return (
        <>
          {renderMessage(translate('addFriendScreen.blocked'))}
          {renderAction(translate('addFriendScreen.manageBlockedUsers'), () =>
            Navigation.navigate(ROUTES.SETTINGS_PRIVACY_BLOCKED_USERS),
          )}
        </>
      );
    }
    if (userData?.friends?.[ownerID]) {
      return (
        <>
          {renderMessage(
            translate('addFriendScreen.alreadyFriends', {displayName}),
          )}
          {renderAction(translate('addFriendScreen.viewProfile'), () =>
            Navigation.navigate(ROUTES.PROFILE.getRoute(ownerID)),
          )}
        </>
      );
    }
    return (
      <>
        {renderMessage(translate('addFriendScreen.invitedYou', {displayName}))}
        <Button
          success
          large
          text={translate('addFriendScreen.addFriend')}
          onPress={addFriend}
          isLoading={isRedeeming}
          isDisabled={isOffline}
          style={[styles.w100, styles.mt5]}
        />
        {isOffline ? (
          <Text
            style={[
              styles.textLabelSupporting,
              styles.textAlignCenter,
              styles.mt2,
            ]}>
            {translate('common.thisFeatureRequiresInternet')}
          </Text>
        ) : null}
        {redeemError ? (
          <Text
            style={[styles.textAlignCenter, styles.mt3, {color: theme.danger}]}>
            {translate(REDEEM_ERROR_MESSAGES[redeemError])}
          </Text>
        ) : null}
      </>
    );
  };

  const renderBody = () => {
    if (!code) {
      return renderInvalid();
    }
    if (preview) {
      return (
        <>
          <View style={[styles.alignItemsCenter, styles.mb5]}>
            <ProfileImage
              photoUrl={preview.profile.photo_url}
              style={styles.avatarXLarge}
            />
            <Text
              style={[styles.headerText, styles.textAlignCenter, styles.mt3]}>
              {displayName}
            </Text>
          </View>
          {currentUserID ? renderSignedIn(preview.userID) : renderSignedOut()}
        </>
      );
    }
    if (isOffline) {
      return renderMessage(translate('common.thisFeatureRequiresInternet'));
    }
    if (loadError === 'invalid') {
      return renderInvalid();
    }
    if (loadError) {
      return (
        <>
          {renderMessage(translate('addFriendScreen.error.couldNotLoad'))}
          {renderAction(translate('addFriendScreen.tryAgain'), retryLoad)}
        </>
      );
    }
    return <FlexibleLoadingIndicator />;
  };

  return (
    <ScreenWrapper testID={AddFriendScreen.displayName}>
      <HeaderWithBackButton
        title={translate('addFriendScreen.title')}
        onBackButtonPress={() => Navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={[
          styles.flexGrow1,
          styles.alignItemsCenter,
          styles.p5,
        ]}>
        <View
          style={[styles.w100, styles.alignItemsCenter, localStyles.content]}>
          {renderBody()}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

AddFriendScreen.displayName = 'AddFriendScreen';
export default AddFriendScreen;
