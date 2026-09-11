import type GetOperatingSystem from '@libs/getOperatingSystem/types';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';

type StoreBadge = 'appStore' | 'googlePlay';

type StoreBadgeLayout = {
  /** Badges in display order; both stores always show */
  badges: StoreBadge[];

  /** The line under the "Get the Kiroku app" heading */
  hint: TranslationPaths;
};

/**
 * Which store badge comes first for a web visitor, and the hint line that goes
 * with it. The visitor's own store leads, but neither is hidden: people share
 * links across platforms, and a laptop visitor may want either.
 */
function getStoreBadgeLayout(
  os: ReturnType<GetOperatingSystem>,
): StoreBadgeLayout {
  if (os === CONST.OS.ANDROID) {
    return {
      badges: ['googlePlay', 'appStore'],
      hint: 'addFriendScreen.forYourAndroid',
    };
  }
  if (os === CONST.OS.IOS) {
    return {
      badges: ['appStore', 'googlePlay'],
      hint: 'addFriendScreen.forYourIphone',
    };
  }
  return {
    badges: ['appStore', 'googlePlay'],
    hint: 'addFriendScreen.availableOn',
  };
}

export default getStoreBadgeLayout;
export type {StoreBadge, StoreBadgeLayout};
