import type {ValueOf} from 'type-fest';
import type {MaybePhraseKey} from '@libs/Localize';
import type {AvatarSource} from '@libs/UserUtils';
import type CONST from '@src/CONST';

type PendingAction = ValueOf<typeof CONST.RED_BRICK_ROAD_PENDING_ACTION> | null;

type PendingFields<TKey extends string> = {
  [key in Exclude<
    TKey,
    'pendingAction' | 'pendingFields' | 'errorFields'
  >]?: PendingAction;
};

type OfflineFeedback<TKey extends string> = {
  /** The type of action that's pending  */
  pendingAction?: PendingAction;

  /** Field-specific pending states for offline updates */
  pendingFields?: PendingFields<TKey>;
};

/** Onyx data with offline properties that store information about data that was written while the app was offline */
type OnyxValueWithOfflineFeedback<
  TOnyx,
  TKey extends string = never,
> = keyof TOnyx extends string
  ? TOnyx & OfflineFeedback<keyof TOnyx | TKey>
  : never;

/** Mapping of form fields with errors */
type ErrorFields<TKey extends string = string> = Record<
  TKey,
  Errors | null | undefined
>;

/** Mapping of form fields with error translation keys and variables */
type Errors = Record<string, string | null>;

type AvatarType = typeof CONST.ICON_TYPE_AVATAR;

type Icon = {
  /** Avatar source to display */
  source: AvatarSource;

  /** Denotes whether it is an avatar or a workspace avatar */
  type: AvatarType;

  /** Owner of the avatar. If user, displayName. If workspace, policy name */
  name?: string;

  /** Avatar id */
  id: string;

  /** A fallback avatar icon to display when there is an error on loading avatar from remote URL. */
  fallbackIcon?: AvatarSource;

  /** Fill color of the icon */
  fill?: string;
};

type UserID = string;

type UserList = Record<UserID, boolean>;

type UserArray = UserID[];

type MeasureType = 'drinks' | 'units';

export type {
  AvatarType,
  ErrorFields,
  Errors,
  Icon,
  MeasureType,
  OnyxValueWithOfflineFeedback,
  PendingAction,
  UserArray,
  UserID,
  UserList,
};
