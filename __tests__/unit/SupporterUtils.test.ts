/**
 * @jest-environment node
 */

import SupporterUtils from '@libs/SupporterUtils';
import CONFIG from '@src/CONFIG';

jest.mock('@src/CONFIG', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- ES module interop flag required for default-export mocks.
  __esModule: true,
  default: {IS_IN_PRODUCTION: false},
}));

const mockedCONFIG = CONFIG as unknown as {IS_IN_PRODUCTION: boolean};

describe('libs/SupporterUtils.isSupporterTierVisible', () => {
  afterEach(() => {
    mockedCONFIG.IS_IN_PRODUCTION = false;
  });

  it('returns true outside production (dev / staging / adhoc)', () => {
    mockedCONFIG.IS_IN_PRODUCTION = false;
    expect(SupporterUtils.isSupporterTierVisible()).toBe(true);
  });

  it('returns false in production builds', () => {
    mockedCONFIG.IS_IN_PRODUCTION = true;
    expect(SupporterUtils.isSupporterTierVisible()).toBe(false);
  });
});
