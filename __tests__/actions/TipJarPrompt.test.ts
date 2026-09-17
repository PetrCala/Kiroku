/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/naming-convention -- jest mock factory keys (__esModule) are dictated by Node module shape */
/* eslint-disable @typescript-eslint/unbound-method -- references to mocked methods are read-only assertions, not actual call sites */
/* eslint-disable rulesdir/prefer-actions-set-data -- this is a test that asserts on the mocked Onyx.merge, not app code */

import Onyx from 'react-native-onyx';
import Navigation from '@libs/Navigation/Navigation';
import * as TipJarPromptActions from '@userActions/TipJarPrompt';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';

jest.mock('react-native-onyx', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    merge: jest.fn(() => Promise.resolve()),
    set: jest.fn(() => Promise.resolve()),
    METHOD: {MERGE: 'merge', SET: 'set'},
  },
}));

jest.mock('@src/CONFIG', () => ({
  __esModule: true,
  default: {IS_IN_PRODUCTION: false},
}));

jest.mock('@libs/Navigation/Navigation', () => ({
  __esModule: true,
  default: {
    navigate: jest.fn(),
  },
}));

describe('TipJarPrompt actions', () => {
  const NOW = 1_800_000_000_000;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    // Drain any moment left armed by a previous test.
    TipJarPromptActions.consumeMoment();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('recordFirstOpen', () => {
    it('starts the clock on a device that has none', () => {
      TipJarPromptActions.recordFirstOpen(undefined);
      expect(Onyx.merge).toHaveBeenCalledWith(ONYXKEYS.TIP_JAR_PROMPT, {
        firstOpenAt: NOW,
      });
    });

    it('never overwrites an existing first-open stamp', () => {
      TipJarPromptActions.recordFirstOpen(NOW - 1000);
      expect(Onyx.merge).not.toHaveBeenCalled();
    });
  });

  describe('the moment', () => {
    it('is spent by the first consume after arming', () => {
      expect(TipJarPromptActions.consumeMoment()).toBe(false);
      TipJarPromptActions.armMoment();
      expect(TipJarPromptActions.consumeMoment()).toBe(true);
      expect(TipJarPromptActions.consumeMoment()).toBe(false);
    });
  });

  describe('open', () => {
    it('shows the card and counts the impression', () => {
      TipJarPromptActions.open(1);
      expect(Onyx.merge).toHaveBeenCalledWith(ONYXKEYS.TIP_JAR_PROMPT, {
        isOpen: true,
        shownCount: 2,
        lastShownAt: NOW,
      });
    });
  });

  describe('developer shortcuts', () => {
    it('"Show now" opens the card with the clock backdated past the gate', () => {
      TipJarPromptActions.devShowNow();
      expect(Onyx.set).toHaveBeenCalledWith(ONYXKEYS.TIP_JAR_PROMPT, {
        firstOpenAt: NOW - CONST.TIP_JAR_PROMPT.MIN_MS_SINCE_FIRST_OPEN,
        shownCount: 1,
        lastShownAt: NOW,
        isOpen: true,
        dismissedForever: false,
      });
    });

    it('"Make eligible" backdates the clock, forgets impressions, and arms the moment', () => {
      TipJarPromptActions.devMakeEligible();
      expect(Onyx.set).toHaveBeenCalledWith(ONYXKEYS.TIP_JAR_PROMPT, {
        firstOpenAt: NOW - CONST.TIP_JAR_PROMPT.MIN_MS_SINCE_FIRST_OPEN,
        shownCount: 0,
      });
      expect(TipJarPromptActions.consumeMoment()).toBe(true);
    });

    it('"Reset" forgets the state', () => {
      TipJarPromptActions.devReset();
      expect(Onyx.set).toHaveBeenCalledWith(ONYXKEYS.TIP_JAR_PROMPT, null);
    });

    it('do nothing in production', () => {
      const config = CONFIG as {IS_IN_PRODUCTION: boolean};
      config.IS_IN_PRODUCTION = true;
      try {
        TipJarPromptActions.devShowNow();
        TipJarPromptActions.devMakeEligible();
        TipJarPromptActions.devReset();
      } finally {
        config.IS_IN_PRODUCTION = false;
      }
      expect(Onyx.set).not.toHaveBeenCalled();
      expect(TipJarPromptActions.consumeMoment()).toBe(false);
    });
  });

  describe('answers', () => {
    it('"Buy us a beer" closes the card and opens the Support screen', () => {
      TipJarPromptActions.acceptAndOpenSupport();
      expect(Onyx.merge).toHaveBeenCalledWith(ONYXKEYS.TIP_JAR_PROMPT, {
        isOpen: false,
      });
      expect(Navigation.navigate).toHaveBeenCalledWith(ROUTES.SETTINGS_SUPPORT);
    });

    it('"Not now" only closes the card', () => {
      TipJarPromptActions.dismiss();
      expect(Onyx.merge).toHaveBeenCalledWith(ONYXKEYS.TIP_JAR_PROMPT, {
        isOpen: false,
      });
      expect(Navigation.navigate).not.toHaveBeenCalled();
    });

    it('"Don\'t ask again" closes the card for good', () => {
      TipJarPromptActions.dismissForever();
      expect(Onyx.merge).toHaveBeenCalledWith(ONYXKEYS.TIP_JAR_PROMPT, {
        isOpen: false,
        dismissedForever: true,
      });
    });
  });
});
