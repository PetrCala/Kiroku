/**
 * @jest-environment node
 */

import type {AppSettings} from '@src/types/onyx';
import {validateAppVersion} from '@libs/Validation';

describe('validateAppVersion', () => {
  let appSettings: AppSettings;
  // Mock the current version of the application
  const mockCurrentVersion = '5.6.7-0';
  // Mock minimum required versions to test against
  const olderMinorVersion = '5.6.6-0';
  const newerMinorVersion = '5.6.8-0';
  const olderMiddleVersion = '5.5.8-0';
  const newerMiddleVersion = '5.7.8-0';
  const olderMajorVersion = '4.6.8-0';
  const newerMajorVersion = '6.6.8-0';
  const olderBuildNumber = '5.6.7-1';
  const newerBuildNumber = '5.6.7-2';
  const newerVersionWithLowerBuildNumber = '5.6.8-0';

  beforeEach(() => {
    appSettings = {} as AppSettings;
  });

  it('validates minor version number correctly', () => {
    appSettings.min_supported_version = olderMinorVersion;
    const olderMinorVersionResult = validateAppVersion(
      appSettings,
      mockCurrentVersion,
    );
    appSettings.min_supported_version = newerMinorVersion;
    const newerMinorVersionResult = validateAppVersion(
      appSettings,
      mockCurrentVersion,
    );

    expect(olderMinorVersionResult.success).toBe(true);
    expect(newerMinorVersionResult.success).toBe(false);
  });

  it('validates middle version number correctly', () => {
    appSettings.min_supported_version = olderMiddleVersion;
    const olderMiddleVersionResult = validateAppVersion(
      appSettings,
      mockCurrentVersion,
    );
    appSettings.min_supported_version = newerMiddleVersion;
    const newerMiddleVersionResult = validateAppVersion(
      appSettings,
      mockCurrentVersion,
    );

    expect(olderMiddleVersionResult.success).toBe(true);
    expect(newerMiddleVersionResult.success).toBe(false);
  });

  it('validates major version number correctly', () => {
    appSettings.min_supported_version = olderMajorVersion;
    const olderMajorVersionResult = validateAppVersion(
      appSettings,
      mockCurrentVersion,
    );
    appSettings.min_supported_version = newerMajorVersion;
    const newerMajorVersionResult = validateAppVersion(
      appSettings,
      mockCurrentVersion,
    );

    expect(olderMajorVersionResult.success).toBe(true);
    expect(newerMajorVersionResult.success).toBe(false);
  });

  it('validates build number correctly', () => {
    appSettings.min_supported_version = olderBuildNumber;

    const olderBuildNumberResult = validateAppVersion(
      appSettings,
      newerBuildNumber,
    );

    expect(olderBuildNumberResult.success).toBe(true);
  });

  it('validates version with lower build number correctly', () => {
    appSettings.min_supported_version = olderBuildNumber;

    const newerVersionWithLowerBuildNumberResult = validateAppVersion(
      appSettings,
      newerVersionWithLowerBuildNumber,
    );

    expect(newerVersionWithLowerBuildNumberResult.success).toBe(true);
  });
});
