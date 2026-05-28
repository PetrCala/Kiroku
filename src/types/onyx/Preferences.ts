import type CONST from '@src/CONST';
import type DeepValueOf from '@src/types/utils/DeepValueOf';
import type Locale from './Locale';
import type {DrinkKey} from './Drinks';
import type {UserID} from './OnyxCommon';

/** Theme of the application */
type Theme = DeepValueOf<typeof CONST.THEME>;

/** A model mapping units to session colors */
type UnitsToColors = {
  /** At maximum how many units a session is still yellow */
  yellow: number;

  /** At maximum how many units a session is still orange */
  orange: number;
};

/** A model mapping drinks to unit values */
type DrinksToUnits = Record<DrinkKey, number>;

/** A model mapping session band names to hex colors */
type SessionColorPalette = {
  /** Hex color for zero-unit (green) band */
  green: string;

  /** Hex color for low-unit (yellow) band */
  yellow: string;

  /** Hex color for mid-unit (orange) band */
  orange: string;

  /** Hex color for high-unit (red) band */
  red: string;

  /** Hex color for blackout sessions */
  black: string;
};

/** User's preferences */
type Preferences = {
  /** User's preferred first day of week */
  first_day_of_week: string;

  /** Preferences that determine at how many units the session color should change */
  units_to_colors: UnitsToColors;

  /** Preferences that determine how many units each drink equals to */
  drinks_to_units: DrinksToUnits;

  /** User's preferred locale */
  locale?: Locale;

  /** User's preferred theme */
  theme?: Theme;

  /** User's selected session color palette */
  session_color_palette?: SessionColorPalette;

  /** When true, other users' sessions are rendered using the viewer's own
   *  palette instead of each owner's palette. Undefined/false preserves the
   *  original behavior (each user's own palette is shown). */
  use_own_palette_for_others?: boolean;

  /** When true and the OS-level location permission is granted, each drink
   *  added to a LIVE session is tagged with the user's current GPS location.
   *  Off by default. Edit-session adds never capture location regardless. */
  track_location_during_sessions?: boolean;

  /** Whether the user permits Crashlytics/Performance diagnostic collection.
   *  Undefined/true means enabled (legitimate-interest default); false is an
   *  explicit opt-out. Only ever takes effect when the build flag
   *  CONFIG.SEND_CRASH_REPORTS is also true. */
  crash_reporting_enabled?: boolean;
};

/** A collection of preferences of multiple users */
type PreferencesList = Record<UserID, Preferences>;

export default Preferences;
export type {
  UnitsToColors,
  DrinksToUnits,
  PreferencesList,
  Theme,
  SessionColorPalette,
};
