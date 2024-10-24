/* eslint-disable @typescript-eslint/naming-convention */
import type {LinkingOptions} from '@react-navigation/native';
import type {RootStackParamList} from '@navigation/types';
import NAVIGATORS from '@src/NAVIGATORS';
import ROUTES from '@src/ROUTES';
import type {Screen} from '@src/SCREENS';
import SCREENS from '@src/SCREENS';
import type {RouteConfig} from './createNormalizedConfigs';
import createNormalizedConfigs from './createNormalizedConfigs';
import {exact} from 'prop-types';

// Moved to a separate file to avoid cyclic dependencies.
const config: LinkingOptions<RootStackParamList>['config'] = {
  initialRouteName: NAVIGATORS.BOTTOM_TAB_NAVIGATOR,
  screens: {
    // Main Routes
    [SCREENS.FORCE_UPDATE]: ROUTES.FORCE_UPDATE,
    [SCREENS.LOGIN]: ROUTES.LOGIN,
    [SCREENS.SIGNUP]: ROUTES.SIGNUP,

    // Sidebar
    [NAVIGATORS.BOTTOM_TAB_NAVIGATOR]: {
      path: ROUTES.ROOT,
      initialRouteName: SCREENS.HOME,
      screens: {
        [SCREENS.HOME]: ROUTES.HOME,
        // [SCREENS.ALL_SETTINGS]: ROUTES.ALL_SETTINGS,
        // [SCREENS.WORKSPACE.INITIAL]: {
        //   path: ROUTES.WORKSPACE_INITIAL.route,
        //   exact: true,
        // },
      },
    },

    [SCREENS.NOT_FOUND]: '*',
    [NAVIGATORS.LEFT_MODAL_NAVIGATOR]: {
      screens: {
        //         [SCREENS.LEFT_MODAL.SEARCH]: {
        //             screens: {
        //                 [SCREENS.SEARCH_ROOT]: ROUTES.SEARCH,
        //             },
        //         },
        // ...
      },
    },

    [NAVIGATORS.TZ_FIX_NAVIGATOR]: {
      path: ROUTES.TZ_FIX_INTRODUCTION,
      initialRouteName: SCREENS.TZ_FIX.INTRODUCTION,
      screens: {
        [SCREENS.TZ_FIX.INTRODUCTION]: {
          path: ROUTES.TZ_FIX_INTRODUCTION,
          exact: true,
        },
        [SCREENS.TZ_FIX.DETECTION]: {
          path: ROUTES.TZ_FIX_DETECTION,
          exact: true,
        },
        [SCREENS.TZ_FIX.SELECTION]: {
          path: ROUTES.TZ_FIX_SELECTION,
          exact: true,
        },
        [SCREENS.TZ_FIX.CONFIRMATION]: {
          path: ROUTES.TZ_FIX_CONFIRMATION,
          exact: true,
        },
        [SCREENS.TZ_FIX.SUCCESS]: {
          path: ROUTES.TZ_FIX_SUCCESS,
          exact: true,
        },
      },
    },
    [NAVIGATORS.RIGHT_MODAL_NAVIGATOR]: {
      screens: {
        [SCREENS.RIGHT_MODAL.ACHIEVEMENTS]: {
          screens: {
            [SCREENS.ACHIEVEMENTS.ROOT]: ROUTES.ACHIEVEMENTS,
          },
        },
        [SCREENS.RIGHT_MODAL.DAY_OVERVIEW]: {
          screens: {
            [SCREENS.DAY_OVERVIEW.ROOT]: {
              path: ROUTES.DAY_OVERVIEW.route,
            },
          },
        },
        [SCREENS.RIGHT_MODAL.DRINKING_SESSION]: {
          screens: {
            [SCREENS.DRINKING_SESSION.ROOT]: {
              path: ROUTES.DRINKING_SESSION.route,
            },
            [SCREENS.DRINKING_SESSION.LIVE]: {
              path: ROUTES.DRINKING_SESSION_LIVE.route,
            },
            [SCREENS.DRINKING_SESSION.SUMMARY]: {
              path: ROUTES.DRINKING_SESSION_SUMMARY.route,
            },
          },
        },
        [SCREENS.RIGHT_MODAL.SETTINGS]: {
          screens: {
            [SCREENS.SETTINGS.ROOT]: {
              path: ROUTES.SETTINGS,
              exact: true,
            },
            [SCREENS.SETTINGS.ACCOUNT.ROOT]: {
              path: ROUTES.SETTINGS_ACCOUNT,
              exact: true,
            },
            [SCREENS.SETTINGS.PREFERENCES.ROOT]: {
              path: ROUTES.SETTINGS_PREFERENCES,
              exact: true,
            },
            [SCREENS.SETTINGS.PREFERENCES.LANGUAGE]: {
              path: ROUTES.SETTINGS_LANGUAGE,
              exact: true,
            },
            [SCREENS.SETTINGS.PREFERENCES.THEME]: {
              path: ROUTES.SETTINGS_THEME,
              exact: true,
            },
            [SCREENS.SETTINGS.ACCOUNT.USER_NAME]: {
              path: ROUTES.SETTINGS_USER_NAME,
              exact: true,
            },
            [SCREENS.SETTINGS.ACCOUNT.DISPLAY_NAME]: {
              path: ROUTES.SETTINGS_DISPLAY_NAME,
              exact: true,
            },
            [SCREENS.SETTINGS.ACCOUNT.EMAIL]: {
              path: ROUTES.SETTINGS_EMAIL,
              exact: true,
            },
            [SCREENS.SETTINGS.ACCOUNT.PASSWORD]: {
              path: ROUTES.SETTINGS_PASSWORD,
              exact: true,
            },
            [SCREENS.SETTINGS.ACCOUNT.TIMEZONE]: {
              path: ROUTES.SETTINGS_TIMEZONE,
              exact: true,
            },
            [SCREENS.SETTINGS.ACCOUNT.TIMEZONE_SELECT]: {
              path: ROUTES.SETTINGS_TIMEZONE_SELECT,
              exact: true,
            },
            [SCREENS.SETTINGS.APP_SHARE]: ROUTES.SETTINGS_APP_SHARE,
            [SCREENS.SETTINGS.PRIVACY_POLICY]: ROUTES.SETTINGS_PRIVACY_POLICY,
            [SCREENS.SETTINGS.TERMS_OF_SERVICE]:
              ROUTES.SETTINGS_TERMS_OF_SERVICE,
            [SCREENS.SETTINGS.FEEDBACK]: ROUTES.SETTINGS_FEEDBACK,
            [SCREENS.SETTINGS.DELETE]: {
              path: ROUTES.SETTINGS_DELETE,
              exact: true,
            },
          },
        },
        [SCREENS.RIGHT_MODAL.PROFILE]: {
          screens: {
            [SCREENS.PROFILE.ROOT]: {
              path: ROUTES.PROFILE.route,
            },
            [SCREENS.PROFILE.FRIENDS_FRIENDS]: {
              path: ROUTES.PROFILE_FRIENDS_FRIENDS.route,
            },
          },
        },
        [SCREENS.RIGHT_MODAL.SOCIAL]: {
          screens: {
            [SCREENS.SOCIAL.ROOT]: ROUTES.SOCIAL,
            [SCREENS.SOCIAL.FRIEND_LIST]: ROUTES.SOCIAL_FRIEND_LIST,
            [SCREENS.SOCIAL.FRIEND_REQUESTS]: ROUTES.SOCIAL_FRIEND_REQUESTS,
            [SCREENS.SOCIAL.FRIEND_SEARCH]: ROUTES.SOCIAL_FRIEND_SEARCH,
          },
        },
        [SCREENS.RIGHT_MODAL.STATISTICS]: {
          screens: {
            [SCREENS.STATISTICS.ROOT]: ROUTES.STATISTICS,
          },
        },
      },
    },
  },
};

const normalizedConfigs = Object.keys(config.screens)
  .map(key =>
    createNormalizedConfigs(
      key,
      config.screens,
      [],
      config.initialRouteName
        ? [
            {
              initialRouteName: config.initialRouteName,
              parentScreens: [],
            },
          ]
        : [],
      [],
    ),
  )
  .flat()
  .reduce(
    (acc, route) => {
      acc[route.screen as Screen] = route;
      return acc;
    },
    {} as Record<Screen, RouteConfig>,
  );

export {normalizedConfigs};
export default config;
