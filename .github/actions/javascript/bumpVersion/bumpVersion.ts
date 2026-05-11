import * as core from '@actions/core';
import {execFile as originalExecFile} from 'child_process';
import fs from 'fs';
import type {PackageJson} from 'type-fest';
import {promisify} from 'util';
import {
  generateAndroidVersionCode,
  updateAndroidVersion,
  updateiOSVersion,
} from '@github/libs/nativeVersionUpdater';
import * as versionUpdater from '@github/libs/versionUpdater';
import type {SemverLevel} from '@github/libs/versionUpdater';

const execFile = promisify(originalExecFile);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getSemverLevelInput(): SemverLevel {
  const semanticVersionLevel = core
    .getInput('SEMVER_LEVEL', {required: true})
    .trim()
    .toUpperCase();
  if (
    !semanticVersionLevel ||
    !versionUpdater.isValidSemverLevel(semanticVersionLevel)
  ) {
    throw new Error(
      `Invalid input for 'SEMVER_LEVEL': ${semanticVersionLevel || '<empty>'}. Expected one of: ${Object.values(versionUpdater.SEMANTIC_VERSION_LEVELS).join(', ')}`,
    );
  }

  return semanticVersionLevel;
}

function getPreviousVersion(): string {
  const {version: previousVersion} = JSON.parse(
    fs.readFileSync('./package.json', {encoding: 'utf8'}),
  ) as PackageJson;
  if (typeof previousVersion !== 'string' || previousVersion.length === 0) {
    throw new Error('Could not read version from package.json');
  }

  return previousVersion;
}

/**
 * Update the native app versions.
 */
async function updateNativeVersions(version: string): Promise<void> {
  console.log(`Updating native versions to ${version}`);

  // Update Android
  const androidVersionCode = generateAndroidVersionCode(version);
  try {
    await updateAndroidVersion(version, androidVersionCode);
    console.log('Successfully updated Android!');
  } catch (error) {
    throw new Error(`Error updating Android: ${getErrorMessage(error)}`);
  }

  // Update iOS
  try {
    const cfBundleVersion = updateiOSVersion(version);
    if (
      typeof cfBundleVersion === 'string' &&
      cfBundleVersion.split('.').length === 4
    ) {
      core.setOutput('NEW_IOS_VERSION', cfBundleVersion);
      console.log('Successfully updated iOS!');
    } else {
      throw new Error(
        `Failed to set NEW_IOS_VERSION. CFBundleVersion: ${cfBundleVersion}`,
      );
    }
  } catch (error) {
    throw new Error(`Error updating iOS: ${getErrorMessage(error)}`);
  }
}

async function updateNpmVersion(version: string): Promise<void> {
  console.log(`Setting npm version to ${version}`);
  const {stdout, stderr} = await execFile('npm', [
    '--no-git-tag-version',
    'version',
    version,
    '-m',
    `Update version to ${version}`,
  ]);
  if (stdout) {
    console.log(stdout);
  }
  if (stderr) {
    console.error(stderr);
  }
}

async function run(): Promise<void> {
  const semanticVersionLevel = getSemverLevelInput();
  const previousVersion = getPreviousVersion();
  const newVersion = versionUpdater.incrementVersion(
    previousVersion,
    semanticVersionLevel,
  );
  console.log(
    `Previous version: ${previousVersion}`,
    `New version: ${newVersion}`,
  );

  await updateNativeVersions(newVersion);
  await updateNpmVersion(newVersion);

  core.setOutput('NEW_VERSION', newVersion);
}

run().catch((error: unknown) => {
  core.setFailed(getErrorMessage(error));
});
