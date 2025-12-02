import type {ComponentType, ReactNode} from 'react';
import React, {createContext, useContext} from 'react';
import {useOnyx} from 'react-native-onyx';
import type {OnyxKey, OnyxValue} from '@src/ONYXKEYS';
import type ChildrenProps from '@src/types/utils/ChildrenProps';
import {UCFirst} from '@libs/StringUtilsKiroku';

// createOnyxContext return type
type CreateOnyxContext<TOnyxKey extends OnyxKey> = [
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ComponentType<any>, // Deprecated withOnyx HOC (for backward compatibility)
  ComponentType<ChildrenProps>, // Provider
  React.Context<OnyxValue<TOnyxKey>>, // Context
  () => NonNullable<OnyxValue<TOnyxKey>>, // useOnyxContext hook
];

// Sentinel value to detect when context is used outside of provider
const NOT_PROVIDED = Symbol('NOT_PROVIDED');

export default <TOnyxKey extends OnyxKey>(
  onyxKeyName: TOnyxKey,
): CreateOnyxContext<TOnyxKey> => {
  const Context = createContext<OnyxValue<TOnyxKey> | typeof NOT_PROVIDED>(
    NOT_PROVIDED as OnyxValue<TOnyxKey>,
  );

  function Provider(props: ChildrenProps): ReactNode {
    const [value] = useOnyx(onyxKeyName, {canBeMissing: true});
    const contextValue = (value ?? null) as OnyxValue<TOnyxKey>;
    return (
      <Context.Provider value={contextValue}>{props.children}</Context.Provider>
    );
  }

  Provider.displayName = `${UCFirst(onyxKeyName)}Provider`;

  // Deprecated HOC for backward compatibility - maintains old withOnyx two-step calling pattern
  // Old pattern: withNetwork()(Component)
  const withOnyxKey = () => (Component: ComponentType<any>) => {
    console.warn(
      `withOnyx HOC is deprecated. Use ${UCFirst(onyxKeyName)}Provider and useOnyxContext instead.`,
    );
    return Component;
  };

  const useOnyxContext = () => {
    const value = useContext(Context);
    if (value === NOT_PROVIDED) {
      throw new Error(
        `useOnyxContext must be used within OnyxProvider [key: ${onyxKeyName}]`,
      );
    }
    return value as NonNullable<OnyxValue<TOnyxKey>>;
  };

  return [withOnyxKey, Provider, Context, useOnyxContext];
};
