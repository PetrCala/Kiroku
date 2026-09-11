/**
 * @jest-environment node
 */
import getStoreBadgeLayout from '@libs/StoreBadgeUtils';
import CONST from '@src/CONST';

describe('getStoreBadgeLayout', () => {
  it('leads with Google Play for Android visitors', () => {
    expect(getStoreBadgeLayout(CONST.OS.ANDROID)).toEqual({
      badges: ['googlePlay', 'appStore'],
      hint: 'addFriendScreen.forYourAndroid',
    });
  });

  it('leads with the App Store for iPhone visitors', () => {
    expect(getStoreBadgeLayout(CONST.OS.IOS)).toEqual({
      badges: ['appStore', 'googlePlay'],
      hint: 'addFriendScreen.forYourIphone',
    });
  });

  it.each([CONST.OS.MAC_OS, CONST.OS.WINDOWS, CONST.OS.LINUX, null])(
    'shows both stores with the neutral hint on %s',
    os => {
      expect(getStoreBadgeLayout(os)).toEqual({
        badges: ['appStore', 'googlePlay'],
        hint: 'addFriendScreen.availableOn',
      });
    },
  );

  it('never hides a store', () => {
    [CONST.OS.ANDROID, CONST.OS.IOS, null].forEach(os => {
      expect([...getStoreBadgeLayout(os).badges].sort()).toEqual([
        'appStore',
        'googlePlay',
      ]);
    });
  });
});
