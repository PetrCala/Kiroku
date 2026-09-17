import {useCallback, useEffect, useState} from 'react';
import Log from '@libs/Log';
import * as SessionPhotoActions from '@userActions/SessionPhoto';
import type {
  DrinkingSessionId,
  SessionPhotos,
  SignedSessionPhotos,
} from '@src/types/onyx';
import type {UserID} from '@src/types/onyx/OnyxCommon';

// Stable reference for "nothing to show" so consumers don't churn.
const EMPTY_PHOTOS: SignedSessionPhotos = {};

/** What one fetch produced, kept together so a render never mixes two fetches. */
type FetchResult = {
  /** The photo ids this result was fetched for. */
  photoIds: string;

  /** The signed photos, empty when the fetch failed or found nothing. */
  photos: SignedSessionPhotos;

  /** Whether the fetch failed, so the caller can say so. */
  hasError: boolean;
};

type SessionPhotoUrls = {
  /** The photos the viewer may see, each with a signed read url. */
  photos: SignedSessionPhotos;

  /** True while a fetch is in flight for the current set of photos. */
  isLoading: boolean;

  /** True when the last fetch failed. */
  hasError: boolean;

  /** Re-fetch, e.g. after a url has expired. */
  refresh: () => void;
};

/** The set of photo ids, as one primitive an effect can depend on. */
function getPhotoIds(photos: SessionPhotos | undefined): string {
  return Object.keys(photos ?? {})
    .sort()
    .join(',');
}

/**
 * Signed read urls for a session's photos, held for as long as the gallery is
 * on screen.
 *
 * Session images are private objects, so a url is the only way to display one
 * and it expires (`GET /v1/images/session-photos`). That is why these live in
 * component state rather than Onyx: a persisted url would go stale, and it
 * would keep working for a viewer who has since lost access. The photo RECORDS
 * do live in Onyx, on the session, so when the session's `photos` map changes
 * (added or removed, from this device or another) the urls are fetched again.
 *
 * The result carries the photo ids it was fetched for, so `isLoading` is
 * derived rather than a second piece of state: a result for a different set of
 * ids than the session currently has IS the loading state. That keeps the
 * effect from setting state synchronously just to reset it.
 */
function useSessionPhotoUrls(
  sessionId: DrinkingSessionId | undefined,
  photos: SessionPhotos | undefined,
  userID?: UserID,
): SessionPhotoUrls {
  const photoIds = getPhotoIds(photos);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = useCallback(() => setRefreshToken(token => token + 1), []);

  useEffect(() => {
    if (!sessionId || photoIds === '') {
      return undefined;
    }
    let isCurrent = true;
    SessionPhotoActions.fetchSessionPhotoUrls(sessionId, userID)
      .then(fetched => {
        // The session (or the signed-in user) may have changed while the
        // request was in flight; a late response must not overwrite a newer one.
        if (isCurrent) {
          setResult({photoIds, photos: fetched, hasError: false});
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent) {
          return;
        }
        Log.warn('useSessionPhotoUrls: could not load session photos', {error});
        setResult({photoIds, photos: EMPTY_PHOTOS, hasError: true});
      });
    return () => {
      isCurrent = false;
    };
  }, [sessionId, photoIds, userID, refreshToken]);

  // A session with no photos needs no fetch and is never loading. Otherwise the
  // result is only usable when it was fetched for the ids the session has now.
  if (photoIds === '') {
    return {photos: EMPTY_PHOTOS, isLoading: false, hasError: false, refresh};
  }
  if (result?.photoIds !== photoIds) {
    return {photos: EMPTY_PHOTOS, isLoading: true, hasError: false, refresh};
  }
  return {
    photos: result.photos,
    isLoading: false,
    hasError: result.hasError,
    refresh,
  };
}

export default useSessionPhotoUrls;
export type {SessionPhotoUrls};
