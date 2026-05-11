import {promisify} from 'util';
import * as fs from 'fs';
import {execFile as execFileCallback} from 'child_process';
import yargs from 'yargs/yargs';
import {hideBin} from 'yargs/helpers';
import {
  SEMANTIC_VERSION_LEVELS,
  incrementVersion,
  isValidSemverLevel,
} from './versionUpdater';
import type {SemverLevel} from './versionUpdater';
import {
  updateAndroidVersion,
  updateiOSVersion,
  generateAndroidVersionCode,
} from './nativeVersionUpdater';

const execFile = promisify(execFileCallback);

const argv = yargs(hideBin(process.argv))
  .option('SEMVER_LEVEL', {
    alias: 'semver',
    describe: 'The semantic version level to increment',
    type: 'string',
    demandOption: true,
  })
  .parseSync();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Update the native app versions.
 *
 * @param version - The new version string.
 */
async function updateNativeVersions(version: string): Promise<void> {
  // Update Android
  try {
    const androidVersionCode = generateAndroidVersionCode(version);
    await updateAndroidVersion(version, androidVersionCode);
  } catch (error) {
    throw new Error(`Error updating Android: ${getErrorMessage(error)}`);
  }

  // Update iOS
  try {
    const cfBundleVersion = updateiOSVersion(version);
    if (
      typeof cfBundleVersion !== 'string' ||
      cfBundleVersion.split('.').length !== 4
    ) {
      throw new Error(
        `Failed to update iOS version. CFBundleVersion: ${cfBundleVersion}`,
      );
    }
  } catch (error) {
    throw new Error(`Error updating iOS: ${getErrorMessage(error)}`);
  }
}

function getSemverLevelInput(): SemverLevel {
  const semanticVersionLevel = String(argv.SEMVER_LEVEL ?? '')
    .trim()
    .toUpperCase();
  if (!semanticVersionLevel || !isValidSemverLevel(semanticVersionLevel)) {
    throw new Error(
      `Invalid input for 'SEMVER_LEVEL': ${
        semanticVersionLevel || '<empty>'
      }. Expected one of: ${Object.values(SEMANTIC_VERSION_LEVELS).join(', ')}`,
    );
  }

  return semanticVersionLevel;
}

type PackageJson = {
  version?: unknown;
};

async function run(): Promise<void> {
  const semanticVersionLevel = getSemverLevelInput();
  const packageJsonContent = fs.readFileSync('./package.json', 'utf8');
  const packageJson: PackageJson = JSON.parse(packageJsonContent);
  const previousVersion = packageJson.version;
  if (typeof previousVersion !== 'string' || previousVersion.length === 0) {
    throw new Error('Could not read version from package.json');
  }

  const newVersion = incrementVersion(previousVersion, semanticVersionLevel);

  await updateNativeVersions(newVersion);

  await execFile('npm', [
    '--no-git-tag-version',
    'version',
    newVersion,
    '-m',
    `Update version to ${newVersion}`,
  ]);

  // Output only the new version
  console.log(newVersion);
}

run().catch(error => {
  console.error('An error occurred:', getErrorMessage(error));
  process.exit(1);
});
