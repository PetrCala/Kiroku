import type {
  ForwardedRef,
  KeyboardEvent,
  KeyboardEventHandler,
  MouseEventHandler,
} from 'react';
import React, {forwardRef} from 'react';
import type {
  GestureResponderEvent,
  // eslint-disable-next-line no-restricted-imports
  Text as RNText,
  StyleProp,
  TextStyle,
} from 'react-native';
import useEnvironment from '@hooks/useEnvironment';
import useThemeStyles from '@hooks/useThemeStyles';
import {openExternalLink, openLink as openLinkUtil} from '@userActions/Link';
import CONST from '@src/CONST';
import type {TextProps} from './Text';
import Text from './Text';

type LinkProps = {
  /** Link to open in new tab */
  href: string;

  onPress?: undefined;
};

type PressProps = {
  href?: undefined;

  /** Overwrites the default link behavior with a custom callback */
  onPress: (event: GestureResponderEvent | KeyboardEvent) => void;
};

type TextLinkProps = (LinkProps | PressProps) &
  TextProps & {
    /** Additional style props */
    style?: StyleProp<TextStyle>;

    /** Callback that is called when mousedown is triggered */
    onMouseDown?: MouseEventHandler;

    /**
     * Always open `href` in the system browser (or a new tab on web), skipping
     * the same-origin internal-navigation heuristic in {@link openLinkUtil}.
     * Use for public pages (e.g. the terms/privacy marketing pages) that live
     * on the app's own origin but have no matching in-app route, which would
     * otherwise resolve to the Not Found screen.
     */
    forceExternal?: boolean;
  };

function TextLink(
  {
    href,
    onPress,
    children,
    style,
    onMouseDown = event => event.preventDefault(),
    forceExternal = false,
    ...rest
  }: TextLinkProps,
  ref: ForwardedRef<RNText>,
) {
  const {environmentURL} = useEnvironment();
  const styles = useThemeStyles();

  const openLink = (event: GestureResponderEvent | KeyboardEvent) => {
    if (onPress) {
      onPress(event);
    } else if (forceExternal) {
      openExternalLink(href);
    } else {
      openLinkUtil(href, environmentURL);
    }
  };

  const openLinkOnTap = (event: GestureResponderEvent) => {
    event.preventDefault();

    openLink(event);
  };

  const openLinkOnEnterKey: KeyboardEventHandler = event => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();

    openLink(event);
  };

  return (
    <Text
      style={[styles.link, style]}
      role={CONST.ROLE.LINK}
      href={href}
      onPress={openLinkOnTap}
      onKeyDown={openLinkOnEnterKey}
      onMouseDown={onMouseDown}
      ref={ref}
      suppressHighlighting
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...rest}>
      {children}
    </Text>
  );
}

TextLink.displayName = 'TextLink';

export type {LinkProps, PressProps};

export default forwardRef(TextLink);
