import React from 'react';
import ONYXKEYS from '@src/ONYXKEYS';
import ComposeProviders from './ComposeProviders';
import createOnyxContext from './createOnyxContext';

// Set up any providers for individual keys. This should only be used in cases where many components will subscribe to
// the same key (e.g. FlatList renderItem components)
const [NetworkProvider, NetworkContext] = createOnyxContext(ONYXKEYS.NETWORK);
const [UserDataProvider, , useUserData] = createOnyxContext(
  ONYXKEYS.USER_DATA_LIST,
);
const [PreferredThemeProvider, PreferredThemeContext] = createOnyxContext(
  ONYXKEYS.PREFERRED_THEME,
);
const [SessionProvider, , useSession] = createOnyxContext(ONYXKEYS.SESSION);

type OnyxProviderProps = {
  /** Rendered child component */
  children: React.ReactNode;
};

function OnyxProvider(props: OnyxProviderProps) {
  return (
    <ComposeProviders
      components={[
        NetworkProvider,
        UserDataProvider,
        PreferredThemeProvider,
        SessionProvider,
      ]}>
      {props.children}
    </ComposeProviders>
  );
}

OnyxProvider.displayName = 'OnyxProvider';

export default OnyxProvider;

export {useUserData, NetworkContext, PreferredThemeContext, useSession};
