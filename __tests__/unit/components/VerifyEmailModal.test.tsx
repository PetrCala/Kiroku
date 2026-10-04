/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */

/**
 * VerifyEmailModal's failure state. Sign-up fires the verification email
 * without waiting for it, so when Firebase rejects the send the modal used to
 * open on "We sent a verification link" anyway. With the send-failed marker
 * set it has to say that no mail went out and put the resend up front.
 */
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import {useOnyx} from 'react-native-onyx';
import VerifyEmailModal from '@components/VerifyEmailModal';
import * as User from '@userActions/User';
import ERRORS from '@src/ERRORS';

const mockUser = {
  email: 'jane@example.com',
  emailVerified: false,
  reload: jest.fn(() => Promise.resolve()),
};

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  useOnyx: jest.fn(),
  default: {connect: jest.fn(), set: jest.fn(() => Promise.resolve())},
}));

jest.mock('@context/global/FirebaseContext', () => ({
  useFirebase: () => ({auth: {currentUser: mockUser}}),
}));

jest.mock('@userActions/User', () => ({
  sendVerifyEmailLink: jest.fn(),
  sendUpdateEmailLink: jest.fn(),
}));

jest.mock('@libs/actions/Session', () => ({signOut: jest.fn()}));

jest.mock('@libs/UserUtils', () => ({
  setDevBypassEmailVerification: jest.fn(),
}));

jest.mock('@libs/ValidationUtils', () => ({validateEmail: jest.fn()}));

// Log schedules a periodic flush timer at import that fires after teardown.
jest.mock('@libs/Log', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    alert: jest.fn(),
    hmmm: jest.fn(),
  },
}));

// The theme/style hooks reach the whole design system; the modal only needs
// style objects to spread, so hand it empty ones.
jest.mock('@hooks/useThemeStyles', () => ({
  __esModule: true,
  default: () =>
    new Proxy(
      {},
      {
        get: (_target, key) =>
          typeof key === 'string' && key.startsWith('Symbol') ? undefined : {},
      },
    ),
}));

jest.mock('@hooks/useTheme', () => ({
  __esModule: true,
  default: () => ({appColor: '#000000'}),
}));

// Localize is stubbed to the key plus its params, so an assertion can name the
// string the modal shows without depending on the English copy.
jest.mock('@hooks/useLocalize', () => ({
  __esModule: true,
  default: () => ({
    translate: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

// The real Button reaches react-native-reanimated, whose native side is not
// initialized under jest. The `success` button is the one the screen leads
// with, so mark it for the assertions.
jest.mock('@components/Button', () => {
  const {Text, TouchableOpacity} = require('react-native') as {
    Text: React.ComponentType<{children?: React.ReactNode}>;
    TouchableOpacity: React.ComponentType<{
      onPress?: () => void;
      testID?: string;
      accessibilityRole?: string;
      children?: React.ReactNode;
    }>;
  };
  return {
    __esModule: true,
    default: ({
      onPress,
      text,
      success,
    }: {
      onPress?: () => void;
      text?: string;
      success?: boolean;
    }) => (
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        testID={success ? 'primary-button' : undefined}>
        <Text>{text ?? ''}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@components/Text', () => {
  const {Text} = require('react-native') as {
    Text: React.ComponentType<{children?: React.ReactNode}>;
  };
  return {
    __esModule: true,
    default: ({children}: {children?: React.ReactNode}) => (
      <Text>{children}</Text>
    ),
  };
});

jest.mock('@components/DotIndicatorMessage', () => {
  const {Text} = require('react-native') as {
    Text: React.ComponentType<{children?: React.ReactNode}>;
  };
  return {
    __esModule: true,
    default: ({messages}: {messages: Record<string, string>}) => (
      <Text>{Object.values(messages).join(' ')}</Text>
    ),
  };
});

// The modal, safe-area and pressable stacks are not what is under test.
jest.mock('@components/Modal', () => ({
  __esModule: true,
  default: ({
    isVisible,
    children,
  }: {
    isVisible: boolean;
    children: React.ReactNode;
  }) => (isVisible ? children : null),
}));

jest.mock('@components/SafeAreaConsumer', () => ({
  __esModule: true,
  default: ({
    children,
  }: {
    children: (insets: {
      safeAreaPaddingBottomStyle: Record<string, number>;
    }) => React.ReactNode;
  }) => children({safeAreaPaddingBottomStyle: {}}),
}));

jest.mock('@components/Pressable', () => {
  const {TouchableOpacity} = require('react-native') as {
    TouchableOpacity: React.ComponentType<{
      onPress?: () => void;
      accessibilityRole?: string;
      children?: React.ReactNode;
    }>;
  };
  return {
    PressableWithFeedback: ({
      onPress,
      children,
    }: {
      onPress?: () => void;
      children?: React.ReactNode;
    }) => (
      <TouchableOpacity onPress={onPress} accessibilityRole="button">
        {children}
      </TouchableOpacity>
    ),
  };
});

jest.mock('@components/Icon', () => ({__esModule: true, default: () => null}));
jest.mock('@components/Icon/KirokuIcons', () => ({Mail: {}, Checkmark: {}}));
jest.mock('@components/SuccessAnimation', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@components/TextInput', () => ({
  __esModule: true,
  default: () => null,
}));

const mockedUseOnyx = jest.mocked(useOnyx);
const mockedSendVerifyEmailLink = jest.mocked(User.sendVerifyEmailLink);

const EMAIL_PARAMS = JSON.stringify({email: 'jane@example.com'});
const SEND_FAILED_COPY = `verifyEmailScreen.sendFailed:${EMAIL_PARAMS}`;
const INBOX_COPY = `verifyEmailScreen.body:${EMAIL_PARAMS}`;

/** The value of the send-failed marker, as the modal reads it from Onyx. */
function setSendFailedMarker(code: string | undefined) {
  mockedUseOnyx.mockReturnValue([
    code,
    {status: 'loaded'},
  ] as unknown as ReturnType<typeof useOnyx>);
}

async function renderModal() {
  render(<VerifyEmailModal />);
  // Let the mount-time `user.reload()` settle so its state update is flushed.
  await act(async () => {
    await Promise.resolve();
  });
}

function primaryButton() {
  return within(screen.getByTestId('primary-button'));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedSendVerifyEmailLink.mockResolvedValue(undefined);
});

describe('VerifyEmailModal send-failed state', () => {
  it('points at the inbox and leads with "I have verified" when the mail went out', async () => {
    setSendFailedMarker(undefined);
    await renderModal();

    expect(screen.getByText(INBOX_COPY)).toBeTruthy();
    expect(screen.queryByText(SEND_FAILED_COPY)).toBeNull();
    expect(
      primaryButton().getByText('verifyEmailScreen.iHaveVerified'),
    ).toBeTruthy();
  });

  it('says the mail could not be sent and leads with Resend when the first send failed', async () => {
    setSendFailedMarker(ERRORS.AUTH.QUOTA_EXCEEDED);
    await renderModal();

    expect(screen.getByText(SEND_FAILED_COPY)).toBeTruthy();
    expect(screen.queryByText(INBOX_COPY)).toBeNull();
    expect(
      primaryButton().getByText('verifyEmailScreen.resendEmail'),
    ).toBeTruthy();
    // The way to confirm is still there for a mail that arrives late.
    expect(screen.getByText('verifyEmailScreen.iHaveVerified')).toBeTruthy();
  });

  it('returns to the inbox copy once a resend goes out', async () => {
    setSendFailedMarker(ERRORS.AUTH.QUOTA_EXCEEDED);
    // The real action clears the marker when the send succeeds.
    mockedSendVerifyEmailLink.mockImplementation(() => {
      setSendFailedMarker(undefined);
      return Promise.resolve();
    });
    await renderModal();

    fireEvent.press(screen.getByText('verifyEmailScreen.resendEmail'));

    expect(await screen.findByText('verifyEmailScreen.emailSent')).toBeTruthy();
    expect(mockedSendVerifyEmailLink).toHaveBeenCalledWith(mockUser);
    expect(screen.getByText(INBOX_COPY)).toBeTruthy();
    expect(screen.queryByText(SEND_FAILED_COPY)).toBeNull();
  });

  it('keeps the failure state and shows the mapped copy when the resend is rejected too', async () => {
    setSendFailedMarker(ERRORS.AUTH.QUOTA_EXCEEDED);
    mockedSendVerifyEmailLink.mockRejectedValue(
      new Error('Firebase: Error (auth/quota-exceeded).'),
    );
    await renderModal();

    fireEvent.press(screen.getByText('verifyEmailScreen.resendEmail'));

    // ErrorUtils is real here, so this is the English copy behind the code,
    // not the raw "Firebase: Error (...)" string.
    expect(
      await screen.findByText(
        "We've hit a limit on our side. Please try again later.",
      ),
    ).toBeTruthy();
    expect(screen.getByText(SEND_FAILED_COPY)).toBeTruthy();
  });

  it('shows an already translated error, such as the cooldown, as it is', async () => {
    setSendFailedMarker(undefined);
    mockedSendVerifyEmailLink.mockRejectedValue(
      new Error('Please wait before sending another verification email.'),
    );
    await renderModal();

    fireEvent.press(screen.getByText('verifyEmailScreen.resendEmail'));

    expect(
      await screen.findByText(
        'Please wait before sending another verification email.',
      ),
    ).toBeTruthy();
  });
});
