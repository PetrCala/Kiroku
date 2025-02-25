import type {
  ComponentType,
  ForwardedRef,
  ReactElement,
  ReactNode,
  RefAttributes,
} from 'react';
import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {ValueOf} from 'type-fest';
import * as Environment from '@libs/Environment/Environment';
import getComponentDisplayName from '@libs/getComponentDisplayName';
import CONST from '@src/CONST';

type EnvironmentProviderProps = {
  /** Actual content wrapped by this component */
  children: ReactNode;
};

type EnvironmentValue = ValueOf<typeof CONST.ENVIRONMENT>;

type EnvironmentContextValue = {
  /** The string value representing the current environment */
  environment: EnvironmentValue;

  /** The string value representing the URL of the current environment */
  environmentURL: string;
};

const EnvironmentContext = createContext<EnvironmentContextValue>({
  environment: CONST.ENVIRONMENT.PROD,
  environmentURL: CONST.KIROKU_URL,
});

function EnvironmentProvider({
  children,
}: EnvironmentProviderProps): ReactElement {
  const [environment, setEnvironment] = useState<EnvironmentValue>(
    CONST.ENVIRONMENT.PROD,
  );
  const [
    environmentURL,
    // setEnvironmentURL
  ] = useState(CONST.KIROKU_URL);

  useEffect(() => {
    Environment.getEnvironment().then(setEnvironment);
    // Environment.getEnvironmentURL().then(setEnvironmentURL); // TODO enable this
  }, []);

  const contextValue = useMemo(
    (): EnvironmentContextValue => ({
      environment,
      environmentURL,
    }),
    [environment, environmentURL],
  );

  return (
    <EnvironmentContext.Provider value={contextValue}>
      {children}
    </EnvironmentContext.Provider>
  );
}

EnvironmentProvider.displayName = 'EnvironmentProvider';

export default function withEnvironment<
  TProps extends EnvironmentContextValue,
  TRef,
>(
  WrappedComponent: ComponentType<TProps & RefAttributes<TRef>>,
): (
  props: Omit<TProps, keyof EnvironmentContextValue> &
    React.RefAttributes<TRef>,
) => ReactElement | null {
  function WithEnvironment(
    props: Omit<TProps, keyof EnvironmentContextValue>,
    ref: ForwardedRef<TRef>,
  ): ReactElement {
    const {environment, environmentURL} = useContext(EnvironmentContext);
    return (
      <WrappedComponent
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...(props as TProps)}
        ref={ref}
        environment={environment}
        environmentURL={environmentURL}
      />
    );
  }

  WithEnvironment.displayName = `withEnvironment(${getComponentDisplayName(WrappedComponent)})`;

  return forwardRef(WithEnvironment);
}

export {EnvironmentContext, EnvironmentProvider};
export type {EnvironmentContextValue};
