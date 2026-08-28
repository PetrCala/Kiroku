import type {Semver, Timestamp} from './OnyxCommon';

/** A model of global application settings */
type AppSettings = {
  /** Minimum supported version of the application */
  min_supported_version?: Semver;

  /** A minimum version in which a user can create a new account */
  min_user_creation_possible_version?: Semver;

  /** The latest app version available to the users */
  latest_version?: Semver;
};

/** A model of maintenance related data */
type Maintenance = {
  /** Whether or not a maintenance is ongoing */
  maintenance_mode: boolean;

  /** Start time of the maintenance */
  start_time?: number;

  /** End time of the maintenance */
  end_time?: number;
};

/** Global configuration data */
type Config = {
  /** Application settings */
  app_settings: AppSettings;

  /** Information about the application maintenance */
  maintenance: Maintenance;

  /** A timestamp representing the last update of terms and conditions */
  terms_last_updated?: Timestamp;

  /** Global default threshold (in hours) for auto-closing stale ongoing
   *  sessions, applied to users who have not set their own
   *  `auto_close_sessions_after_hours`. Server-tunable at deploy time; when
   *  absent the client falls back to `CONST.SESSION.AUTO_CLOSE.DEFAULT_HOURS`. */
  auto_close_default_hours?: number;
};

export default Config;
export type {Maintenance, AppSettings};
