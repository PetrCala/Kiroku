import asyncOpenURL from '@libs/asyncOpenURL';
import Navigation from '@libs/Navigation/Navigation';
import * as Url from '@libs/Url';
import type {Route} from '@src/ROUTES';

/**
 * Open an external link in the browser (new tab on web, system browser on native).
 */
function openExternalLink(url: string, shouldSkipCustomSafariLogic = false) {
  asyncOpenURL(Promise.resolve(), url, shouldSkipCustomSafariLogic);
}

/**
 * Open a link. Same-origin Kiroku links are navigated internally via react-navigation,
 * everything else is opened externally.
 */
function openLink(href: string, environmentURL: string) {
  if (Url.hasSameOrigin(href, environmentURL)) {
    const path = Url.getPathFromURL(href);
    if (path) {
      Navigation.navigate(path as Route);
      return;
    }
  }

  openExternalLink(href);
}

export {openExternalLink, openLink};
