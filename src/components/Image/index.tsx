import React, {useMemo} from 'react';
import {useOnyx} from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import BaseImage from './BaseImage';
import type {ImageOwnProps} from './types';

function Image({
  source: propsSource,
  isAuthTokenRequired = false,
  ...forwardedProps
}: ImageOwnProps) {
  const [session] = useOnyx(ONYXKEYS.SESSION, {canBeMissing: true});
  /**
   * Check if the image source is a URL - if so the `encryptedAuthToken` is appended
   * to the source.
   */
  const source = useMemo(() => {
    if (typeof propsSource === 'object' && 'uri' in propsSource) {
      if (typeof propsSource.uri === 'number') {
        return propsSource.uri;
      }
      const authToken = session?.encryptedAuthToken ?? null;
      if (isAuthTokenRequired && authToken) {
        return {
          ...propsSource,
          // headers: {
          //     [CONST.CHAT_ATTACHMENT_TOKEN_KEY]: authToken,
          // },
        };
      }
    }
    return propsSource;
    // The session prop is not required, as it causes the image to reload whenever the session changes. For more information, please refer to issue #26034.
    // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
  }, [propsSource, isAuthTokenRequired]);

  return (
    <BaseImage
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...forwardedProps}
      source={source}
    />
  );
}

function imagePropsAreEqual(
  prevProps: ImageOwnProps,
  nextProps: ImageOwnProps,
) {
  return prevProps.source === nextProps.source;
}

const MemoizedImage = React.memo(Image, imagePropsAreEqual);

MemoizedImage.displayName = 'Image';

export default MemoizedImage;
