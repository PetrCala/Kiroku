import type {StackScreenProps} from '@react-navigation/stack';
import React, {useCallback, useReducer, useState} from 'react';
import {View} from 'react-native';
import Button from '@components/Button';
import ConfirmModal from '@components/ConfirmModal';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import LinkAnimation from '@components/LinkAnimation';
import Modal from '@components/Modal';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import Text from '@components/Text';
import {useFirebase} from '@context/global/FirebaseContext';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import * as ErrorUtils from '@libs/ErrorUtils';
import Navigation from '@libs/Navigation/Navigation';
import type {SettingsNavigatorParamList} from '@libs/Navigation/types';
import {getOAuthCredential} from '@libs/OAuthCredential';
import * as User from '@userActions/User';
import CONST from '@src/CONST';
import ERRORS from '@src/ERRORS';
import type SCREENS from '@src/SCREENS';
import ReauthPromptModal from './ReauthPromptModal';

type ConnectedAccountsScreenProps = StackScreenProps<
  SettingsNavigatorParamList,
  typeof SCREENS.SETTINGS.ACCOUNT.CONNECTED_ACCOUNTS
>;

type ProviderId = 'password' | 'apple.com' | 'google.com';

type ProviderRow = {
  providerId: ProviderId;
  label: string;
  email: string | null;
  icon: keyof typeof KirokuIcons | null;
  isLinked: boolean;
  isCurrentSession: boolean;
};

type PendingReauth = {
  action: 'link' | 'unlink';
  providerId: string;
};

type SuccessOverlay = {
  mode: 'link' | 'unlink';
  providerId: string;
};

const APPLE_PRIVATE_RELAY_SUFFIX = '.privaterelay.appleid.com';

/**
 * How long the success animation overlay lingers after the animation reports
 * complete. Gives the user a beat to read the text before the modal dismisses.
 */
const SUCCESS_OVERLAY_HOLD_MS = 600;

function rowStatusText(
  row: ProviderRow,
  translate: ReturnType<typeof useLocalize>['translate'],
): string {
  if (!row.isLinked) {
    return translate('connectedAccounts.status.notConnected');
  }
  if (row.isCurrentSession) {
    return translate('connectedAccounts.status.signedInWith');
  }
  return row.email ?? translate('connectedAccounts.status.connected');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ConnectedAccountsScreen({route}: ConnectedAccountsScreenProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const {auth} = useFirebase();

  // providerData on auth.currentUser is mutated in place by Firebase and is
  // not React-tracked. bumpVersion() forces a re-render; the action helpers
  // call auth.currentUser.reload() before resolving so the snapshot we read
  // on the next render is fresh. useReducer keeps the "tick" state opaque so
  // lint doesn't see an unused state variable.
  const [, bumpVersion] = useReducer((tick: number) => tick + 1, 0);

  const [isLoading, setIsLoading] = useState(false);
  const [pendingUnlinkProviderId, setPendingUnlinkProviderId] = useState<
    string | null
  >(null);
  // Queued action that needs to retry after the reauth modal succeeds.
  // Modelled as a discriminated state (not a closure) so the action handlers
  // below don't need to reference themselves — sidesteps a TDZ that
  // react-hooks/immutability would otherwise flag.
  const [pendingReauth, setPendingReauth] = useState<PendingReauth | null>(
    null,
  );
  // The brief celebratory animation that plays after a successful link/unlink.
  // Cleared by the animation's onAnimationEnd → SUCCESS_OVERLAY_HOLD_MS timer.
  const [successOverlay, setSuccessOverlay] = useState<SuccessOverlay | null>(
    null,
  );

  const user = auth.currentUser;
  const providerData = user?.providerData ?? [];
  const linkedSet = new Set(providerData.map(p => p.providerId));
  // Firebase populates providerData[0] with the provider used at sign-in;
  // documented but not always reliable across SDK versions, so missing/extra
  // entries fall back gracefully to no caption rather than mislabelling.
  const currentSessionProviderId = providerData[0]?.providerId ?? null;
  const appleEntry = providerData.find(
    p => p.providerId === CONST.AUTH_PROVIDER.APPLE,
  );
  const googleEntry = providerData.find(
    p => p.providerId === CONST.AUTH_PROVIDER.GOOGLE,
  );

  const rows: ProviderRow[] = [
    {
      providerId: CONST.AUTH_PROVIDER.PASSWORD,
      label: translate('connectedAccounts.providers.password'),
      email: user?.email ?? null,
      icon: null,
      isLinked: linkedSet.has(CONST.AUTH_PROVIDER.PASSWORD),
      isCurrentSession:
        currentSessionProviderId === CONST.AUTH_PROVIDER.PASSWORD,
    },
    {
      providerId: CONST.AUTH_PROVIDER.APPLE,
      label: translate('connectedAccounts.providers.apple'),
      email: appleEntry?.email ?? null,
      icon: 'AppleLogo',
      isLinked: linkedSet.has(CONST.AUTH_PROVIDER.APPLE),
      isCurrentSession: currentSessionProviderId === CONST.AUTH_PROVIDER.APPLE,
    },
    {
      providerId: CONST.AUTH_PROVIDER.GOOGLE,
      label: translate('connectedAccounts.providers.google'),
      email: googleEntry?.email ?? null,
      icon: 'GoogleG',
      isLinked: linkedSet.has(CONST.AUTH_PROVIDER.GOOGLE),
      isCurrentSession: currentSessionProviderId === CONST.AUTH_PROVIDER.GOOGLE,
    },
  ];

  const linkedCount = rows.filter(r => r.isLinked).length;
  const isLastProvider = linkedCount <= 1;
  const appleRow = rows.find(r => r.providerId === CONST.AUTH_PROVIDER.APPLE);
  const appleUsesPrivateRelay = !!appleRow?.email?.endsWith(
    APPLE_PRIVATE_RELAY_SUFFIX,
  );

  const remainingProvidersDescription = (excludeProviderId: string): string =>
    rows
      .filter(r => r.isLinked && r.providerId !== excludeProviderId)
      .map(r => r.label)
      .join(', ');

  const handleLink = useCallback(
    async (providerId: string) => {
      const getCredential = getOAuthCredential[providerId];
      if (!getCredential) {
        // The UI only renders Connect buttons for providers with a credential
        // getter (Apple/Google); this is a defensive no-op for any new
        // provider added without a getter.
        return;
      }
      setIsLoading(true);
      try {
        const credential = await getCredential();
        if (!credential) {
          // User cancelled the native flow or no token was issued.
          return;
        }
        await User.linkOAuthProvider(auth, credential);
        bumpVersion();
        setSuccessOverlay({mode: 'link', providerId});
      } catch (error) {
        const code = (error as {code?: string}).code;
        if (code === ERRORS.AUTH.REQUIRES_RECENT_LOGIN) {
          setPendingReauth({action: 'link', providerId});
          return;
        }
        ErrorUtils.raiseAppError(undefined, error);
      } finally {
        setIsLoading(false);
      }
    },
    [auth, bumpVersion],
  );

  const handleUnlinkConfirmed = useCallback(
    async (providerId: string) => {
      setPendingUnlinkProviderId(null);
      setIsLoading(true);
      try {
        await User.unlinkOAuthProvider(auth, providerId);
        bumpVersion();
        setSuccessOverlay({mode: 'unlink', providerId});
      } catch (error) {
        const code =
          (error as {code?: string}).code ?? (error as Error).message;
        if (code === ERRORS.AUTH.REQUIRES_RECENT_LOGIN) {
          setPendingReauth({action: 'unlink', providerId});
          return;
        }
        ErrorUtils.raiseAppError(undefined, error);
      } finally {
        setIsLoading(false);
      }
    },
    [auth, bumpVersion],
  );

  const handleReauthenticated = useCallback(async () => {
    const queued = pendingReauth;
    setPendingReauth(null);
    if (!queued) {
      return;
    }
    if (queued.action === 'link') {
      await handleLink(queued.providerId);
    } else {
      await handleUnlinkConfirmed(queued.providerId);
    }
  }, [pendingReauth, handleLink, handleUnlinkConfirmed]);

  if (isLoading) {
    return <FullScreenLoadingIndicator />;
  }

  const unlinkConfirmRow = pendingUnlinkProviderId
    ? rows.find(r => r.providerId === pendingUnlinkProviderId)
    : null;

  return (
    <ScreenWrapper
      includeSafeAreaPaddingBottom={false}
      testID={ConnectedAccountsScreen.displayName}>
      <HeaderWithBackButton
        title={translate('connectedAccounts.title')}
        onBackButtonPress={() => Navigation.goBack()}
      />
      <ScrollView style={[styles.flex1, styles.mh5]}>
        <Text style={[styles.mt3, styles.mb3, styles.textSupporting]}>
          {translate('connectedAccounts.subtitle')}
        </Text>
        {rows.map(row => (
          <ProviderRowView
            key={row.providerId}
            row={row}
            isLastProvider={isLastProvider}
            translate={translate}
            styles={styles}
            theme={theme}
            onUnlink={() => setPendingUnlinkProviderId(row.providerId)}
            onLink={() => {
              (async () => {
                await handleLink(row.providerId);
              })();
            }}
          />
        ))}
        {appleUsesPrivateRelay && linkedSet.has(CONST.AUTH_PROVIDER.APPLE) ? (
          <Text style={[styles.textSupporting, styles.mt3, styles.mb5]}>
            {translate('connectedAccounts.privateRelay')}
          </Text>
        ) : null}
      </ScrollView>
      <ConfirmModal
        danger
        title={
          unlinkConfirmRow
            ? translate('connectedAccounts.unlinkConfirm.title', {
                provider: unlinkConfirmRow.label,
              })
            : ''
        }
        prompt={
          pendingUnlinkProviderId
            ? translate('connectedAccounts.unlinkConfirm.prompt', {
                remaining: remainingProvidersDescription(
                  pendingUnlinkProviderId,
                ),
              })
            : ''
        }
        confirmText={translate('connectedAccounts.unlinkConfirm.confirm')}
        cancelText={translate('connectedAccounts.actions.cancel')}
        isVisible={pendingUnlinkProviderId !== null}
        onConfirm={() => {
          const providerId = pendingUnlinkProviderId;
          if (providerId) {
            (async () => {
              await handleUnlinkConfirmed(providerId);
            })();
          }
        }}
        onCancel={() => setPendingUnlinkProviderId(null)}
        shouldShowCancelButton
      />
      {pendingReauth ? (
        <ReauthPromptModal
          linkedProviderIds={Array.from(linkedSet)}
          onCancel={() => setPendingReauth(null)}
          onReauthenticated={handleReauthenticated}
        />
      ) : null}
      <SuccessOverlayModal
        overlay={successOverlay}
        rows={rows}
        translate={translate}
        onDismiss={() => setSuccessOverlay(null)}
      />
    </ScreenWrapper>
  );
}

type SuccessOverlayModalProps = {
  overlay: SuccessOverlay | null;
  rows: ProviderRow[];
  translate: ReturnType<typeof useLocalize>['translate'];
  onDismiss: () => void;
};

/**
 * Centered modal that wraps `LinkAnimation` for the brief post-action moment.
 * After the animation reports complete, holds for `SUCCESS_OVERLAY_HOLD_MS`
 * so the user can read the text, then unmounts via `onDismiss`. Tap-anywhere
 * dismissal is intentionally disabled — the animation is short, and accidental
 * dismissal in the middle of a transform looks jarring.
 */
function SuccessOverlayModal({
  overlay,
  rows,
  translate,
  onDismiss,
}: SuccessOverlayModalProps) {
  const styles = useThemeStyles();
  if (!overlay) {
    return null;
  }
  const row = rows.find(r => r.providerId === overlay.providerId);
  if (!row?.icon) {
    return null;
  }
  const text =
    overlay.mode === 'link'
      ? translate('connectedAccounts.success.connected', {provider: row.label})
      : translate('connectedAccounts.success.disconnected', {
          provider: row.label,
        });
  return (
    <Modal
      isVisible
      type={CONST.MODAL.MODAL_TYPE.CENTERED_UNSWIPEABLE}
      onClose={() => {}}>
      <View style={[styles.p5, styles.alignItemsCenter]}>
        <LinkAnimation
          mode={overlay.mode}
          providerIcon={KirokuIcons[row.icon]}
          shouldTintProviderIcon={
            overlay.providerId === CONST.AUTH_PROVIDER.APPLE
          }
          text={text}
          onAnimationEnd={() => {
            setTimeout(onDismiss, SUCCESS_OVERLAY_HOLD_MS);
          }}
        />
      </View>
    </Modal>
  );
}

type ProviderRowViewProps = {
  row: ProviderRow;
  isLastProvider: boolean;
  translate: ReturnType<typeof useLocalize>['translate'];
  styles: ReturnType<typeof useThemeStyles>;
  theme: ReturnType<typeof useTheme>;
  onUnlink: () => void;
  onLink: () => void;
};

/**
 * One row in the Connected Accounts list. Split out so the conditional
 * Link / Unlink button doesn't need nested ternaries (lint).
 */
function ProviderRowView({
  row,
  isLastProvider,
  translate,
  styles,
  theme,
  onUnlink,
  onLink,
}: ProviderRowViewProps) {
  let actionButton: React.ReactNode = null;
  if (row.providerId !== CONST.AUTH_PROVIDER.PASSWORD) {
    if (row.isLinked) {
      actionButton = (
        <Button
          small
          text={translate('connectedAccounts.actions.disconnect')}
          isDisabled={isLastProvider}
          onPress={onUnlink}
        />
      );
    } else {
      actionButton = (
        <Button
          small
          success
          text={translate('connectedAccounts.actions.connect')}
          onPress={onLink}
        />
      );
    }
  }

  return (
    <View
      style={[
        styles.flexRow,
        styles.alignItemsCenter,
        styles.justifyContentBetween,
        styles.mv2,
        styles.p3,
        styles.br3,
        {borderWidth: 1, borderColor: theme.border},
      ]}>
      <View style={[styles.flexRow, styles.alignItemsCenter, styles.flex1]}>
        {row.icon ? (
          <Icon
            src={KirokuIcons[row.icon]}
            width={20}
            height={20}
            additionalStyles={styles.mr3}
            // The Apple logo is monochrome and needs theme tinting to stay
            // visible in dark mode. The Google "G" is multi-color (brand
            // requirement) and must not be tinted, so we only set fill on
            // providers whose SVG uses `currentColor`.
            fill={
              row.providerId === CONST.AUTH_PROVIDER.APPLE
                ? theme.icon
                : undefined
            }
          />
        ) : null}
        <View style={[styles.flex1]}>
          <Text style={[styles.textStrong]}>{row.label}</Text>
          <Text style={[styles.textSupporting, styles.mt1]}>
            {rowStatusText(row, translate)}
          </Text>
        </View>
      </View>
      {actionButton}
    </View>
  );
}

ConnectedAccountsScreen.displayName = 'ConnectedAccountsScreen';

export default ConnectedAccountsScreen;
