// TODO move these to ValidationUtils.ts
import semver from 'semver';
import type {AppSettings} from '@src/types/onyx';
import {version as _version} from '../../package.json';

const version: string = _version;

type ValidationResult = {
  success: boolean;
  message?: string;
  updateAvailable?: boolean;
};

/** Validate that a string is semver-able. If not, throw an error.
 *
 * SemVer regex pattern to match MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
 * Explanation:
 * - ^v? optional 'v' at the beginning
 * - (0|[1-9]\d*) matches the major version (0, or any non-zero digit followed by any digits)
 * - \.(0|[1-9]\d*) matches the minor version, prefixed by a dot
 * - \.(0|[1-9]\d*) matches the patch version, prefixed by a dot
 * - (-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)? optionally matches pre-release version, prefixed by a hyphen
 * - (\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)? optionally matches build metadata, prefixed by a plus
 * - $ end of string
 *
 * @example
 * validateSemver('1.0.0'); // Valid, no error thrown
 * validateSemver('2.10.3-alpha.1+build.456'); // Valid, no error thrown
 * validateSemver('01.0.0'); // Invalid, error thrown
 */
function validateSemver(ver: string): void {
  const semverRegex =
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  if (!semverRegex.test(ver)) {
    throw new Error('Invalid SemVer version.');
  }
}

/**
 * Cleans a semantic version string by extracting the major, minor, and patch version components.
 * @param version - The semantic version string to clean.
 * @returns The cleaned semantic version string containing only the major, minor, and patch version components.
 */
function cleanSemver(ver: string): string {
  const regex = /^(\d+\.\d+\.\d+)/;
  const match = ver.match(regex);
  return match ? match[1] : ver;
}

/** Input the minimum supported version of the application and validate that the current version is not older than that one. If it is newer, return true, otherwise return false.
 *
 * @param minSupportedVersion Version to validate against.
 * @param currentAppVersion Current version of the application. Defaults to the version stored in 'package.json'. Overwrite this value only in testing.
 * @returns Validation result type object.
 */
const validateAppVersion = (
  appSettings: AppSettings,
  currentAppVersion: string = version,
): ValidationResult => {
  const cleanCurrentAppVersion = cleanSemver(currentAppVersion); // No build metadata

  const minVersion = appSettings?.min_supported_version;
  if (!minVersion || semver.lt(cleanCurrentAppVersion, minVersion)) {
    return {
      success: false,
      message:
        'This version of the application is outdated. Please upgrade to the newest version.',
    };
  }

  const latestVersion = appSettings?.latest_version;
  if (latestVersion && semver.gt(latestVersion, cleanCurrentAppVersion)) {
    return {
      success: true,
      updateAvailable: true,
      message: 'A new version of the application is available.',
    };
  }

  return {
    success: true,
  };
};

export {cleanSemver, validateAppVersion, validateSemver};
export type {ValidationResult};
