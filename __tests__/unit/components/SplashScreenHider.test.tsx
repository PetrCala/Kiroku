/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/no-require-imports, global-require, import/extensions -- we load the web variant explicitly to defeat jest's native-platform resolution */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not call sites */

/**
 * Regression coverage for the web boot-splash deadlock.
 *
 * The `#splash` overlay sits at z-index 10000 and swallows every pointer event,
 * so if the splash-hide gating condition (`shouldHideSplash`) never flips, the
 * app is visible but completely untappable. The authenticated gate
 * (`isAuthDataReady`) has a 3s backstop in Kiroku.tsx, and THIS component is the
 * last-resort net: it force-hides the splash after a bounded timeout no matter
 * why the gate is stuck — including the original failure mode where the lazy
 * AuthScreens (the gate's only setter) never mounts. These tests lock that net
 * in place and prove the hide is idempotent.
 *
 * Notes on the harness:
 *  - We require the web `index.tsx` explicitly: jest resolves the `@components`
 *    alias to `index.native.tsx` (which pulls in the untransformed expo-image),
 *    and the web variant is the one carrying the boot-splash-deadlock fix.
 *  - We drive it with `react-test-renderer` rather than RNTL: RNTL's auto-cleanup
 *    `afterEach` awaits a `setImmediate`, which never fires while jest fake timers
 *    are installed, hanging the suite.
 */
import TestRenderer, {act} from 'react-test-renderer';
import React from 'react';
import BootSplash from '@libs/BootSplash';
import Log from '@libs/Log';
import CONST from '@src/CONST';

jest.mock('@libs/BootSplash', () => ({
  __esModule: true,
  default: {
    hide: jest.fn(() => Promise.resolve()),
    getVisibilityStatus: jest.fn(() => Promise.resolve('visible')),
  },
}));

jest.mock('@libs/Log', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    alert: jest.fn(),
    hmmm: jest.fn(),
  },
}));

type HiderProps = {shouldHideSplash: boolean; onHide?: () => void};
const SplashScreenHider = (
  require('@components/SplashScreenHider/index.tsx') as {
    default: React.ComponentType<HiderProps>;
  }
).default;

const mockedHide = jest.mocked(BootSplash.hide);
const mockedAlert = jest.mocked(Log.alert);

const FORCE_HIDE_MS = CONST.BOOT_SPLASH_FORCE_HIDE_TIMEOUT_MS;

type Renderer = ReturnType<typeof TestRenderer.create>;

function renderHider(props: HiderProps): Renderer {
  let renderer = null as unknown as Renderer;
  act(() => {
    renderer = TestRenderer.create(
      <SplashScreenHider
        shouldHideSplash={props.shouldHideSplash}
        onHide={props.onHide}
      />,
    );
  });
  return renderer;
}

function advance(ms: number): void {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SplashScreenHider force-hide net', () => {
  it('force-hides the splash after the bounded timeout even when shouldHideSplash never flips', () => {
    renderHider({shouldHideSplash: false});

    // The gate is stuck: nothing hides yet.
    advance(FORCE_HIDE_MS - 1);
    expect(mockedHide).not.toHaveBeenCalled();

    // The net trips exactly at the timeout and force-hides, leaving a breadcrumb.
    advance(1);
    expect(mockedHide).toHaveBeenCalledTimes(1);
    expect(mockedAlert).toHaveBeenCalledWith(
      '[BootSplash] shouldHideSplash never became true, force-hiding splash',
      {timeoutMs: FORCE_HIDE_MS},
      false,
    );
  });

  it('clears the force-hide timer once unmounted, so it never fires after teardown', () => {
    const renderer = renderHider({shouldHideSplash: false});
    act(() => {
      renderer.unmount();
    });

    advance(FORCE_HIDE_MS * 2);

    expect(mockedHide).not.toHaveBeenCalled();
    expect(mockedAlert).not.toHaveBeenCalled();
  });
});

describe('SplashScreenHider primary path', () => {
  it('hides immediately when shouldHideSplash is true and does not trip the force-hide net', () => {
    renderHider({shouldHideSplash: true});

    expect(mockedHide).toHaveBeenCalledTimes(1);

    // The 15s net must NOT double-hide or log a force-hide alert once the
    // primary path has already hidden.
    advance(FORCE_HIDE_MS);
    expect(mockedHide).toHaveBeenCalledTimes(1);
    expect(mockedAlert).not.toHaveBeenCalled();
  });

  it('hides once the gate flips from false to true, cancelling the pending net', () => {
    const renderer = renderHider({shouldHideSplash: false});
    expect(mockedHide).not.toHaveBeenCalled();

    act(() => {
      renderer.update(<SplashScreenHider shouldHideSplash />);
    });
    expect(mockedHide).toHaveBeenCalledTimes(1);

    // Idempotent: the once-armed force-hide timer cannot hide a second time.
    advance(FORCE_HIDE_MS);
    expect(mockedHide).toHaveBeenCalledTimes(1);
    expect(mockedAlert).not.toHaveBeenCalled();
  });

  it('invokes onHide after the splash finishes hiding', async () => {
    const onHide = jest.fn();
    renderHider({shouldHideSplash: true, onHide});

    // BootSplash.hide resolves on a microtask; flush it (microtasks are not faked).
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
