import React, {useCallback, useEffect, useState} from 'react';
import {Share, StyleSheet, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Button from '@components/Button';
import ConfirmModal from '@components/ConfirmModal';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import ProfileImage from '@components/ProfileImage';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import {getInviteLink} from '@libs/FriendInviteUtils';
import Navigation from '@libs/Navigation/Navigation';
import {copyToClipboard} from '@libs/StringUtilsKiroku';
import * as FriendInvite from '@userActions/FriendInvite';

/** Largest QR edge: easy to scan from arm's length, still fits small phones. */
const QR_MAX_SIZE = 240;

/** Room the QR card leaves around the code on narrow screens. */
const QR_HORIZONTAL_INSET = 112;

/** How long the copy button reads "Link copied". */
const COPIED_FEEDBACK_MS = 2000;

const localStyles = StyleSheet.create({
  qrCard: {
    padding: 16,
    borderRadius: 16,
  },
  content: {
    maxWidth: 420,
  },
});

/**
 * The signed-in user's personal invite link as a QR code. Friends scan it with
 * the phone's own camera, which opens https://app.kiroku.cz/add/<code> (the
 * app through universal/app links, or the web app). Also offers the native
 * share sheet, copying the link, and rotating it.
 */
function MyQrCodeScreen() {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {windowWidth} = useWindowDimensions();
  const userData = useCurrentUserData();
  const inviteCode = userData?.invite_code;
  const inviteLink = inviteCode ? getInviteLink(inviteCode) : undefined;

  const [hasLoadFailed, setHasLoadFailed] = useState(false);
  const [isResetModalVisible, setIsResetModalVisible] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [hasResetFailed, setHasResetFailed] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);

  // Fetch on every open: creates the code the first time and picks up a code
  // rotated on another device. A cached code renders in the meantime.
  const loadInviteCode = useCallback(() => {
    FriendInvite.fetchInviteCode()
      .then(() => setHasLoadFailed(false))
      .catch(() => setHasLoadFailed(true));
  }, []);

  const {isOffline} = useNetwork();

  // Runs on open and again whenever the connection comes back.
  useEffect(() => {
    if (isOffline) {
      return;
    }
    loadInviteCode();
  }, [isOffline, loadInviteCode]);

  useEffect(() => {
    if (!isLinkCopied) {
      return;
    }
    const timer = setTimeout(() => setIsLinkCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [isLinkCopied]);

  const retryLoad = () => {
    setHasLoadFailed(false);
    loadInviteCode();
  };

  const copyLink = useCallback(() => {
    if (!inviteLink) {
      return;
    }
    copyToClipboard(inviteLink);
    setIsLinkCopied(true);
  }, [inviteLink]);

  // The message carries the link itself, so every target gets it once. On web
  // this is the Web Share API, which many desktop browsers lack; copying the
  // link is the fallback there.
  const shareLink = useCallback(() => {
    if (!inviteLink) {
      return;
    }
    Share.share({
      message: translate('myQrCodeScreen.shareMessage', {link: inviteLink}),
    }).catch(copyLink);
  }, [inviteLink, translate, copyLink]);

  const resetLink = useCallback(() => {
    setIsResetModalVisible(false);
    setIsResetting(true);
    setHasResetFailed(false);
    FriendInvite.resetInviteCode()
      .catch(() => setHasResetFailed(true))
      .finally(() => setIsResetting(false));
  }, []);

  const qrSize = Math.min(QR_MAX_SIZE, windowWidth - QR_HORIZONTAL_INSET);

  const renderQrCode = () => {
    if (inviteLink) {
      // The library's default dark-on-white, on a white card with a quiet
      // zone whatever the theme: phone cameras read that most reliably.
      return (
        <View
          style={[localStyles.qrCard, {backgroundColor: theme.white}]}
          accessible
          accessibilityLabel={translate('myQrCodeScreen.qrCodeLabel')}>
          <QRCode value={inviteLink} size={qrSize} />
        </View>
      );
    }
    if (isOffline) {
      return (
        <Text style={[styles.textNormal, styles.textAlignCenter]}>
          {translate('common.thisFeatureRequiresInternet')}
        </Text>
      );
    }
    if (hasLoadFailed) {
      return (
        <>
          <Text style={[styles.textNormal, styles.textAlignCenter]}>
            {translate('myQrCodeScreen.error.couldNotLoad')}
          </Text>
          <Button
            text={translate('myQrCodeScreen.tryAgain')}
            onPress={retryLoad}
            style={[styles.w100, styles.mt3]}
          />
        </>
      );
    }
    return <FlexibleLoadingIndicator />;
  };

  return (
    <ScreenWrapper testID={MyQrCodeScreen.displayName}>
      <HeaderWithBackButton
        title={translate('myQrCodeScreen.title')}
        onBackButtonPress={Navigation.goBack}
      />
      <ScrollView
        contentContainerStyle={[
          styles.flexGrow1,
          styles.alignItemsCenter,
          styles.p5,
        ]}>
        <View
          style={[styles.w100, styles.alignItemsCenter, localStyles.content]}>
          <ProfileImage
            photoUrl={userData?.profile?.photo_url}
            style={styles.avatarXLarge}
          />
          <Text style={[styles.headerText, styles.textAlignCenter, styles.mt3]}>
            {userData?.profile?.display_name}
          </Text>
          <Text
            style={[
              styles.textLabelSupporting,
              styles.textAlignCenter,
              styles.mt2,
              styles.mb5,
            ]}>
            {translate('myQrCodeScreen.prompt')}
          </Text>
          {renderQrCode()}
          <Button
            success
            large
            icon={KirokuIcons.Share}
            text={translate('myQrCodeScreen.share')}
            onPress={shareLink}
            isDisabled={!inviteLink || isResetting}
            style={[styles.w100, styles.mt5]}
          />
          <Button
            large
            icon={KirokuIcons.Copy}
            text={translate(
              isLinkCopied
                ? 'myQrCodeScreen.linkCopied'
                : 'myQrCodeScreen.copyLink',
            )}
            onPress={copyLink}
            isDisabled={!inviteLink || isResetting}
            style={[styles.w100, styles.mt3]}
          />
          <Button
            text={translate('myQrCodeScreen.resetLink')}
            onPress={() => setIsResetModalVisible(true)}
            isLoading={isResetting}
            isDisabled={!inviteLink || isOffline}
            style={[styles.w100, styles.mt8]}
          />
          {hasResetFailed ? (
            <Text
              style={[
                styles.textAlignCenter,
                styles.mt3,
                {color: theme.danger},
              ]}>
              {translate('myQrCodeScreen.error.couldNotReset')}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <ConfirmModal
        isVisible={isResetModalVisible}
        title={translate('myQrCodeScreen.resetTitle')}
        prompt={translate('myQrCodeScreen.resetPrompt')}
        confirmText={translate('myQrCodeScreen.resetConfirm')}
        onConfirm={resetLink}
        onCancel={() => setIsResetModalVisible(false)}
        shouldDisableConfirmButtonWhenOffline
        danger
      />
    </ScreenWrapper>
  );
}

MyQrCodeScreen.displayName = 'MyQrCodeScreen';
export default MyQrCodeScreen;
