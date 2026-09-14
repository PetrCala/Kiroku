/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable rulesdir/prefer-actions-set-data -- this test seeds the global config directly, the way app open and the config channel deliver it */

/**
 * Remote feature-flag overrides: a boolean in the global config
 * (`config.feature_flags[FLAG]`) wins over the compile-time default in
 * `CONST.FEATURES`, so a flag can be switched off remotely as a kill switch.
 * Runs against real Onyx.
 */
import {act, renderHook, waitFor} from '@testing-library/react-native';
import Onyx from 'react-native-onyx';
import useFeatureFlag from '@hooks/useFeatureFlag';
import * as FeatureFlags from '@libs/FeatureFlags';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Config} from '@src/types/onyx';
import type {FeatureFlagOverrides} from '@src/types/onyx/Config';

// Onyx batches updates through react-dom's unstable_batchedUpdates, which is
// undefined in this RN test environment; run the callback synchronously.
jest.mock('react-native-onyx/dist/batch', () => ({
  __esModule: true,
  default: (callback: () => void) => callback(),
}));

// The flag under test, and a second one used only to check isolation between
// flags. Both default off; a remote override is what turns either on.
const FLAG = 'BADGES';
const OTHER_FLAG = 'LOGO_FLY_IN';

function configWith(featureFlags?: FeatureFlagOverrides): Config {
  return {
    app_settings: {},
    maintenance: {maintenance_mode: false},
    feature_flags: featureFlags,
  };
}

async function setConfig(config: Config | null): Promise<void> {
  await act(async () => {
    await Onyx.set(ONYXKEYS.CONFIG, config);
  });
}

beforeAll(() => {
  Onyx.init({keys: ONYXKEYS});
});

beforeEach(async () => {
  await act(async () => {
    await Onyx.clear();
  });
});

describe('FeatureFlags.isEnabled', () => {
  it('uses the compile-time default without a config', () => {
    expect(CONST.FEATURES[FLAG]).toBe(false);
    expect(FeatureFlags.isEnabled(FLAG)).toBe(false);
  });

  it('turns a flag on remotely', async () => {
    await setConfig(configWith({[FLAG]: true}));
    expect(FeatureFlags.isEnabled(FLAG)).toBe(true);
  });

  it('turns a flag back off remotely (kill switch)', async () => {
    await setConfig(configWith({[FLAG]: true}));
    expect(FeatureFlags.isEnabled(FLAG)).toBe(true);

    await setConfig(configWith({[FLAG]: false}));
    expect(FeatureFlags.isEnabled(FLAG)).toBe(false);
  });

  it('ignores an override that is not a boolean', async () => {
    const config = configWith();
    // What a hand-edited RTDB value could look like.
    (config as {feature_flags: unknown}).feature_flags = {
      [FLAG]: 'true',
      [OTHER_FLAG]: 1,
    };
    await setConfig(config);
    expect(FeatureFlags.isEnabled(FLAG)).toBe(false);
    expect(FeatureFlags.isEnabled(OTHER_FLAG)).toBe(false);
  });

  it('falls back to the default once the override is removed', async () => {
    await setConfig(configWith({[FLAG]: true}));
    expect(FeatureFlags.isEnabled(FLAG)).toBe(true);

    await setConfig(configWith());
    expect(FeatureFlags.isEnabled(FLAG)).toBe(false);
  });

  it('leaves other flags alone', async () => {
    await setConfig(configWith({[FLAG]: true}));
    expect(FeatureFlags.isEnabled(OTHER_FLAG)).toBe(CONST.FEATURES[OTHER_FLAG]);
  });
});

describe('useFeatureFlag', () => {
  it('re-renders when a remote override arrives and when it is removed', async () => {
    const {result} = renderHook(() => useFeatureFlag(FLAG));
    await waitFor(() => expect(result.current).toBe(false));

    await setConfig(configWith({[FLAG]: true}));
    await waitFor(() => expect(result.current).toBe(true));

    await setConfig(configWith());
    await waitFor(() => expect(result.current).toBe(false));
  });
});
