import React, {useCallback, useEffect, useState} from 'react';
import {Share, StyleSheet, View} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import BottomActionBar from '@components/BottomActionBar';
import Button from '@components/Button';
import FlexibleLoadingIndicator from '@components/FlexibleLoadingIndicator';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import ProfileImage from '@components/ProfileImage';
import {PressableWithFeedback} from '@components/Pressable';
import ScrollView from '@components/ScrollView';
import {SupporterBadgeForUser} from '@components/SupporterBadge';
import Text from '@components/Text';
import {useFirebase} from '@context/global/FirebaseContext';
import useCurrentUserData from '@hooks/useCurrentUserData';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import useWindowDimensions from '@hooks/useWindowDimensions';
import {getInviteLink} from '@libs/FriendInviteUtils';
import {copyToClipboard} from '@libs/StringUtilsKiroku';
import variables from '@styles/variables';
import * as FriendInvite from '@userActions/FriendInvite';
import CONST from '@src/CONST';

type InviteCodeViewProps = {
  /** Whether the invite link is being reset (from the hub's menu) */
  isResetting: boolean;

  /** Whether the last reset attempt failed */
  hasResetFailed: boolean;
};

/** Largest QR edge: easy to scan from arm's length, still fits small phones. */
const QR_MAX_SIZE = 220;

/** Screen padding, card padding and the QR panel's quiet zone combined. */
const QR_HORIZONTAL_INSET = 128;

/** Share of the QR edge the Kiroku mark covers (safe at error correction H). */
const QR_LOGO_RATIO = 0.22;

/** How long the copy row reads "Link copied". */
const COPIED_FEEDBACK_MS = 2000;

const AVATAR_SIZE = 76;
const AVATAR_RING = 4;
const BAND_HEIGHT = 44;

// Decorative drink glyphs tiled across the pass band.
const BAND_GLYPHS = [KirokuIcons.Beer, KirokuIcons.Wine, KirokuIcons.Cocktail];
const BAND_SLOTS = Array.from({length: 14}, (_, slot) => ({
  id: `band-glyph-${slot}`,
  src: BAND_GLYPHS[slot % BAND_GLYPHS.length],
}));

const localStyles = StyleSheet.create({
  content: {
    maxWidth: 420,
  },
  pass: {
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: variables.componentBorderRadiusCard,
    overflow: 'hidden',
  },
  band: {
    width: '100%',
    height: BAND_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'hidden',
  },
  bandGlyph: {
    opacity: 0.18,
  },
  avatarRing: {
    marginTop: -(AVATAR_SIZE / 2 + AVATAR_RING),
    borderWidth: AVATAR_RING,
    borderRadius: AVATAR_SIZE / 2 + AVATAR_RING,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  qrPanel: {
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
  },
  qrLogo: {
    position: 'absolute',
  },
  qrPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRow: {
    width: '100%',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 999,
  },
  linkText: {
    flex: 1,
  },
});

/** The pass card's brand band: faint drink glyphs on the brand color. */
function DrinkPatternBand() {
  const theme = useTheme();
  return (
    <View
      style={[localStyles.band, {backgroundColor: theme.appColor}]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {BAND_SLOTS.map(slot => (
        <View key={slot.id} style={localStyles.bandGlyph}>
          <Icon
            src={slot.src}
            width={variables.iconSizeSmall}
            height={variables.iconSizeSmall}
            fill={theme.textOnBrand}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * The "Your code" tab of the Add friends hub. The QR code sits on a profile
 * pass (avatar, name, supporter badge, friend count), so it reads as the
 * user's own profile, the one a friend sees after scanning. One primary
 * action, "Share invite link", is pinned in the bottom bar like other screens'
 * main actions; copying is a quiet row that shows the actual link.
 */
function InviteCodeView({isResetting, hasResetFailed}: InviteCodeViewProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {windowWidth} = useWindowDimensions();
  const {auth} = useFirebase();
  const userData = useCurrentUserData();
  const inviteCode = userData?.invite_code;
  const inviteLink = inviteCode ? getInviteLink(inviteCode) : undefined;
  const friendCount = Object.values(userData?.friends ?? {}).filter(
    Boolean,
  ).length;

  const [hasLoadFailed, setHasLoadFailed] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const {isOffline} = useNetwork();

  // Fetch on every open: creates the code the first time and picks up a code
  // rotated on another device. A cached code renders in the meantime.
  const loadInviteCode = useCallback(() => {
    FriendInvite.fetchInviteCode()
      .then(() => setHasLoadFailed(false))
      .catch(() => setHasLoadFailed(true));
  }, []);

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
  // link (with the row's "Link copied" feedback) is the fallback there.
  const shareLink = useCallback(() => {
    if (!inviteLink) {
      return;
    }
    Share.share({
      message: translate('inviteCode.shareMessage', {link: inviteLink}),
    }).catch(copyLink);
  }, [inviteLink, translate, copyLink]);

  const qrSize = Math.min(QR_MAX_SIZE, windowWidth - QR_HORIZONTAL_INSET);
  const logoSize = Math.round(qrSize * QR_LOGO_RATIO);

  const renderQrCode = () => {
    if (inviteLink) {
      // Dark modules on a white quiet zone whatever the theme: phone cameras
      // read that most reliably. Error correction H keeps the code readable
      // under the Kiroku mark in the middle.
      return (
        <View
          style={[localStyles.qrPanel, {backgroundColor: theme.white}]}
          accessible
          accessibilityLabel={translate('inviteCode.qrCodeLabel')}>
          <QRCode value={inviteLink} size={qrSize} ecl="H" />
          <View
            style={[
              localStyles.qrLogo,
              {
                top: 12 + (qrSize - logoSize) / 2,
                left: 12 + (qrSize - logoSize) / 2,
              },
            ]}>
            <Icon
              src={KirokuIcons.LogoSplash}
              width={logoSize}
              height={logoSize}
            />
          </View>
        </View>
      );
    }
    const placeholderSize = {width: qrSize, height: qrSize};
    if (isOffline) {
      return (
        <View
          style={[
            localStyles.qrPanel,
            localStyles.qrPlaceholder,
            placeholderSize,
          ]}>
          <Text style={[styles.textNormal, styles.textAlignCenter]}>
            {translate('common.thisFeatureRequiresInternet')}
          </Text>
        </View>
      );
    }
    if (hasLoadFailed) {
      return (
        <View
          style={[
            localStyles.qrPanel,
            localStyles.qrPlaceholder,
            placeholderSize,
          ]}>
          <Text style={[styles.textNormal, styles.textAlignCenter]}>
            {translate('inviteCode.error.couldNotLoad')}
          </Text>
          <Button
            large
            text={translate('inviteCode.tryAgain')}
            onPress={retryLoad}
            style={[styles.w100, styles.mt5]}
          />
        </View>
      );
    }
    return (
      <View
        style={[
          localStyles.qrPanel,
          localStyles.qrPlaceholder,
          placeholderSize,
        ]}>
        <FlexibleLoadingIndicator />
      </View>
    );
  };

  return (
    <View style={styles.flex1}>
      <ScrollView
        contentContainerStyle={[
          styles.flexGrow1,
          styles.alignItemsCenter,
          styles.p5,
        ]}>
        <View
          style={[styles.w100, styles.alignItemsCenter, localStyles.content]}>
          <View
            style={[
              localStyles.pass,
              {backgroundColor: theme.cardBG, borderColor: theme.border},
            ]}>
            <DrinkPatternBand />
            <View
              style={[
                localStyles.avatarRing,
                {borderColor: theme.cardBG, backgroundColor: theme.cardBG},
              ]}>
              <ProfileImage
                photoUrl={userData?.profile?.photo_url}
                style={localStyles.avatar}
              />
            </View>
            <View
              style={[
                styles.flexRow,
                styles.alignItemsCenter,
                styles.justifyContentCenter,
                styles.mt2,
                styles.ph4,
              ]}>
              <Text
                style={[styles.textHeadlineH2, styles.flexShrink1]}
                numberOfLines={1}>
                {userData?.profile?.display_name}
              </Text>
              <View style={styles.ml1}>
                <SupporterBadgeForUser
                  userID={auth.currentUser?.uid}
                  size="medium"
                />
              </View>
            </View>
            <Text
              style={[
                styles.textLabelSupporting,
                styles.textAlignCenter,
                styles.mt1,
              ]}>
              {translate('inviteCode.friendCount', {friendCount})}
            </Text>
            {renderQrCode()}
            <Text
              style={[
                styles.headerText,
                styles.textAlignCenter,
                styles.mt3,
                styles.mb5,
                styles.ph4,
              ]}>
              {translate('inviteCode.cardCta')}
            </Text>
          </View>
          <PressableWithFeedback
            accessibilityLabel={translate('inviteCode.copyLink')}
            accessibilityRole={CONST.ROLE.BUTTON}
            onPress={copyLink}
            disabled={!inviteLink}
            style={[
              localStyles.linkRow,
              styles.mt5,
              {borderColor: theme.border},
            ]}>
            <Icon
              src={KirokuIcons.Link}
              width={variables.iconSizeSmall}
              height={variables.iconSizeSmall}
              fill={theme.icon}
            />
            <Text
              style={[styles.textLabelSupporting, localStyles.linkText]}
              numberOfLines={1}>
              {inviteLink?.replace(/^https?:\/\//, '')}
            </Text>
            {isLinkCopied ? (
              <Text style={styles.textLabelSupporting}>
                {translate('inviteCode.linkCopied')}
              </Text>
            ) : null}
            <Icon
              src={isLinkCopied ? KirokuIcons.Checkmark : KirokuIcons.Copy}
              width={variables.iconSizeNormal}
              height={variables.iconSizeNormal}
              fill={isLinkCopied ? theme.text : theme.icon}
            />
          </PressableWithFeedback>
          <Text style={[styles.textNormal, styles.textAlignCenter, styles.mt5]}>
            {translate('inviteCode.explain')}
          </Text>
          {hasResetFailed ? (
            <Text
              style={[styles.textDanger, styles.textAlignCenter, styles.mt3]}>
              {translate('inviteCode.error.couldNotReset')}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <BottomActionBar>
        <Button
          large
          success
          style={styles.bottomTabButton}
          text={translate('inviteCode.share')}
          onPress={shareLink}
          isDisabled={!inviteLink || isResetting}
        />
      </BottomActionBar>
    </View>
  );
}

InviteCodeView.displayName = 'InviteCodeView';
export default InviteCodeView;
