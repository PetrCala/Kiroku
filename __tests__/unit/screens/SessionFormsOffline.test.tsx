/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

/**
 * Regression coverage for renaming or annotating a session while offline.
 *
 * `FormProvider` inherits Expensify's default of disabling the submit button
 * offline, which is right for forms that need the server (email, password,
 * account deletion). Renaming a session and editing its note are offline-safe:
 * a buffered session is updated locally and a stored one goes through the
 * persisted write queue with optimistic data. Both screens must opt in with
 * `enabledWhenOffline`, or the save button is dead offline.
 */
import {render} from '@testing-library/react-native';
import React from 'react';
import SessionNameScreen from '@screens/DrinkingSession/SessionNameScreen';
import SessionNoteScreen from '@screens/DrinkingSession/SessionNoteScreen';

const mockFormProps: {current: Record<string, unknown> | null} = {
  current: null,
};

jest.mock('@components/Form/FormProvider', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockFormProps.current = props;
    return null;
  },
}));
jest.mock('@components/Form/InputWrapper', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@components/HeaderWithBackButton', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@components/ScreenWrapper', () => ({
  __esModule: true,
  default: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('@components/Text', () => {
  const {Text} = require('react-native') as {
    Text: React.ComponentType<{children?: React.ReactNode}>;
  };
  return {__esModule: true, default: Text};
});
jest.mock('@components/TextInput', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@hooks/useCurrentUserDrinkingSessions', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('@hooks/useLocalize', () => ({
  __esModule: true,
  default: () => ({translate: (key: string) => key}),
}));
jest.mock('@hooks/useThemeStyles', () => ({
  __esModule: true,
  default: () => ({flexGrow1: {}, ph5: {}, mb6: {}}),
}));

jest.mock('@libs/DrinkingSessionUtils', () => ({
  __esModule: true,
  getDrinkingSessionData: () => undefined,
}));
jest.mock('@libs/SessionName', () => ({
  __esModule: true,
  getSessionDisplayName: () => '',
}));
jest.mock('@libs/ErrorUtils', () => ({
  __esModule: true,
  addErrorMessage: jest.fn(),
}));
jest.mock('@libs/ValidationUtils', () => ({
  __esModule: true,
  isValidSessionName: () => true,
  isValidSessionNote: () => true,
}));
jest.mock('@libs/Navigation/Navigation', () => ({
  __esModule: true,
  default: {goBack: jest.fn()},
}));
jest.mock('@userActions/DrinkingSession', () => ({
  __esModule: true,
  updateSessionName: jest.fn(),
  updateNote: jest.fn(),
}));

type AnyRoute = {params: {sessionId: string; backTo?: string}};
type AnyScreen = React.ComponentType<{route: AnyRoute; navigation: unknown}>;

function renderScreen(Screen: AnyScreen): Record<string, unknown> | null {
  mockFormProps.current = null;
  render(<Screen route={{params: {sessionId: 'session-1'}}} navigation={{}} />);
  return mockFormProps.current;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('session forms stay submittable offline', () => {
  it('lets a session be renamed while offline', () => {
    const props = renderScreen(SessionNameScreen as AnyScreen);
    expect(props).not.toBeNull();
    expect(props?.enabledWhenOffline).toBe(true);
  });

  it('lets a session note be saved while offline', () => {
    const props = renderScreen(SessionNoteScreen as AnyScreen);
    expect(props).not.toBeNull();
    expect(props?.enabledWhenOffline).toBe(true);
  });
});
