import type {ComponentType, ReactNode} from 'react';
import React, {createContext, useContext} from 'react';
import {useOnyx} from 'react-native-onyx';
import type {OnyxKey, OnyxValue} from '@src/ONYXKEYS';
import type ChildrenProps from '@src/types/utils/ChildrenProps';
import {UCFirst} from '@libs/StringUtilsKiroku';

// createOnyxContext return type
type CreateOnyxContext<TOnyxKey extends OnyxKey> = [
  ComponentType<ChildrenProps>,
  React.Context<OnyxValue<TOnyxKey>>,
  () => NonNullable<OnyxValue<TOnyxKey>>,
];

export default <TOnyxKey extends OnyxKey>(
  onyxKeyName: TOnyxKey,
): CreateOnyxContext<TOnyxKey> => {
  const Context = createContext<OnyxValue<TOnyxKey>>(
    null as unknown as OnyxValue<TOnyxKey>,
  );

  function Provider(props: ChildrenProps): ReactNode {
    const [value] = useOnyx(onyxKeyName, {canBeMissing: true});
    return (
      <Context.Provider value={(value ?? null) as OnyxValue<TOnyxKey>}>
        {props.children}
      </Context.Provider>
    );
  }

  Provider.displayName = `${UCFirst(onyxKeyName)}Provider`;

  const useOnyxContext = () => {
    const value = useContext(Context);
    if (value === null) {
      throw new Error(
        `useOnyxContext must be used within OnyxProvider [key: ${onyxKeyName}]`,
      );
    }
    return value as NonNullable<OnyxValue<TOnyxKey>>;
  };

  return [Provider, Context, useOnyxContext];
};
