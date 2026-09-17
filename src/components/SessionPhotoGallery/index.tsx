import React, {useMemo, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import ConfirmModal from '@components/ConfirmModal';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import Image from '@components/Image';
import RESIZE_MODES from '@components/Image/resizeModes';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import {PressableWithFeedback} from '@components/Pressable';
import Text from '@components/Text';
import UploadImageComponent from '@components/UploadImage';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as SessionPhotoActions from '@userActions/SessionPhoto';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type {
  DrinkingSessionId,
  SessionPhotoId,
  SessionPhotos,
} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';
import useSessionPhotoUrls from './useSessionPhotoUrls';

/** Side of a gallery tile. Three fit a phone row with the row's own gaps. */
const TILE_SIZE = 104;
const TILE_RADIUS = 10;
const ACTION_ICON_SIZE = 16;

type SessionPhotoGalleryProps = {
  /** The session the photos hang off. */
  sessionId: DrinkingSessionId;

  /** The session's photo records, as stored on the session (RFC §4.2). */
  photos: SessionPhotos | undefined;

  /**
   * The session's owner. Omitted when it is the signed-in user's own session,
   * which is also the only case that can add or remove a photo.
   */
  ownerID?: UserID;
};

/**
 * The photos on a session (RFC §9): a row of tiles, plus an add action on the
 * user's own session.
 *
 * The records come from the session in Onyx, so they arrive with the rest of it
 * and update when the server pushes a change from another device. The urls to
 * actually display them are fetched separately and held in state, because a
 * session photo is a private object served through a short-lived signed url
 * (see `useSessionPhotoUrls`).
 *
 * The viewer's own photos can be removed; someone else's can be reported.
 * Blocking already hides a whole user, so reporting is the narrower tool.
 */
function SessionPhotoGallery({
  sessionId,
  photos,
  ownerID,
}: SessionPhotoGalleryProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const [isUploading, setIsUploading] = useState(false);
  const [photoPendingRemoval, setPhotoPendingRemoval] =
    useState<SessionPhotoId | null>(null);
  const isOwnSession = !ownerID;
  const {
    photos: signedPhotos,
    isLoading,
    hasError,
  } = useSessionPhotoUrls(sessionId, photos, ownerID);

  // Oldest first, so the gallery reads in the order the night happened.
  const orderedPhotos = useMemo(
    () =>
      Object.entries(signedPhotos).sort(
        ([, a], [, b]) => a.added_at - b.added_at,
      ),
    [signedPhotos],
  );

  const photoCount = Object.keys(photos ?? {}).length;
  const canAddPhoto =
    isOwnSession && SessionPhotoActions.canAddPhoto(photoCount);

  // One tile shape for both "loading the urls" and "uploading", so the row
  // never changes width as an upload settles into a real photo.
  const placeholderTile = (
    <View
      style={[
        styles.alignItemsCenter,
        styles.justifyContentCenter,
        {
          width: TILE_SIZE,
          height: TILE_SIZE,
          borderRadius: TILE_RADIUS,
          backgroundColor: theme.cardSoftBG,
        },
      ]}>
      <ActivityIndicator size="small" color={theme.spinner} />
    </View>
  );

  const onConfirmRemoval = () => {
    if (photoPendingRemoval) {
      SessionPhotoActions.deleteSessionPhoto(sessionId, photoPendingRemoval);
    }
    setPhotoPendingRemoval(null);
  };

  return (
    <View>
      <View style={[styles.flexRow, styles.flexWrap, styles.gap2]}>
        {orderedPhotos.map(([photoId, photo], index) => (
          <PressableWithFeedback
            key={photoId}
            accessibilityLabel={translate('sessionPhotos.photo', {
              index: index + 1,
              count: orderedPhotos.length,
            })}
            accessibilityRole={CONST.ROLE.BUTTON}
            onPress={() =>
              isOwnSession
                ? setPhotoPendingRemoval(photoId)
                : Navigation.navigate(
                    ROUTES.PROFILE_REPORT_USER.getRoute(ownerID, photo.path),
                  )
            }
            style={[
              {
                width: TILE_SIZE,
                height: TILE_SIZE,
                borderRadius: TILE_RADIUS,
                backgroundColor: theme.cardSoftBG,
              },
              styles.overflowHidden,
            ]}>
            <Image
              source={{uri: photo.url}}
              style={{width: TILE_SIZE, height: TILE_SIZE}}
              resizeMode={RESIZE_MODES.cover}
            />
            {/* The action a tap performs, said once on the tile itself. */}
            <View
              style={[
                styles.pAbsolute,
                styles.p1,
                {
                  right: 0,
                  bottom: 0,
                  borderTopLeftRadius: TILE_RADIUS,
                  backgroundColor: theme.appBG,
                },
              ]}>
              <Icon
                src={isOwnSession ? KirokuIcons.Delete : KirokuIcons.Info}
                width={ACTION_ICON_SIZE}
                height={ACTION_ICON_SIZE}
                fill={theme.textSupporting}
              />
            </View>
          </PressableWithFeedback>
        ))}
        {/* An upload in flight reads as a pending tile on the session, the same
            way any other optimistic session change does. */}
        {isUploading ? (
          <OfflineWithFeedback
            pendingAction={CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD}>
            {placeholderTile}
          </OfflineWithFeedback>
        ) : null}
        {isLoading && !isUploading ? placeholderTile : null}
        {canAddPhoto ? (
          <UploadImageComponent
            src={KirokuIcons.Plus}
            kind={CONST.IMAGE_UPLOAD_KIND.SESSION}
            sessionId={sessionId}
            shouldShowUploadPopup={false}
            onUploadingChange={setIsUploading}
            buttonStyles={{
              width: TILE_SIZE,
              height: TILE_SIZE,
              borderRadius: TILE_RADIUS,
            }}
            testID="session-add-photo"
          />
        ) : null}
      </View>
      {hasError ? (
        <Text style={[styles.textLabelError, styles.mt2]}>
          {translate('sessionPhotos.error.load')}
        </Text>
      ) : null}
      {isOwnSession && photoCount >= CONST.SESSION_PHOTO_LIMIT ? (
        <Text style={[styles.textLabelSupporting, styles.mt2]}>
          {translate('sessionPhotos.limitReached', {
            limit: CONST.SESSION_PHOTO_LIMIT,
          })}
        </Text>
      ) : null}
      <ConfirmModal
        isVisible={!!photoPendingRemoval}
        title={translate('sessionPhotos.remove')}
        prompt={translate('sessionPhotos.removePrompt')}
        confirmText={translate('common.delete')}
        cancelText={translate('common.cancel')}
        onConfirm={onConfirmRemoval}
        onCancel={() => setPhotoPendingRemoval(null)}
        danger
      />
    </View>
  );
}

SessionPhotoGallery.displayName = 'SessionPhotoGallery';
export default SessionPhotoGallery;
