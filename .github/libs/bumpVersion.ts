import {promisify} from 'util';
import * as fs from 'fs';
import {exec as execCallback} from 'child_process';
import yargs from 'yargs/yargs';
import {hideBin} from 'yargs/helpers';
import {SEMANTIC_VERSION_LEVELS, incrementVersion} from './versionUpdater';
import {
  updateAndroidVersion,
  updateiOSVersion,
  generateAndroidVersionCode,
} from './nativeVersionUpdater';

const exec = promisify(execCallback) as (
  command: string,
) => Promise<{stdout: string; stderr: string}>;

interface Arguments {
  SEMVER_LEVEL: string;
}

const argv = yargs(hideBin(process.argv))
  .option('SEMVER_LEVEL', {
    alias: 'semver',
    describe: 'The semantic version level to increment',
    type: 'string',
    demandOption: true,
  })
  .parseSync();

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
  } catch (err: any) {
    console.error('Error updating Android:', err);
    process.exit(1);
  }

  // Update iOS
  try {
    const cfBundleVersion = updateiOSVersion(version);
    if (
      typeof cfBundleVersion !== 'string' ||
      cfBundleVersion.split('.').length !== 4
    ) {
      console.error(
        `Failed to update iOS version. CFBundleVersion: ${cfBundleVersion}`,
      );
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Error updating iOS:', err);
    process.exit(1);
  }
}

// Define a type representing the values of the enum
type SemanticVersionLevel =
  (typeof SEMANTIC_VERSION_LEVELS)[keyof typeof SEMANTIC_VERSION_LEVELS];

let semanticVersionLevel = argv.SEMVER_LEVEL as SemanticVersionLevel;

if (
  !semanticVersionLevel ||
  !Object.values(SEMANTIC_VERSION_LEVELS).includes(semanticVersionLevel)
) {
  console.error(`Invalid input for 'SEMVER_LEVEL': ${semanticVersionLevel}`);
  process.exit(1);
}

interface PackageJson {
  version: string;
  [key: string]: any;
}

try {
  const packageJsonContent = fs.readFileSync('./package.json', 'utf8');
  const packageJson: PackageJson = JSON.parse(packageJsonContent);
  const previousVersion: string = packageJson.version;

  const newVersion = incrementVersion(previousVersion, semanticVersionLevel);

  updateNativeVersions(newVersion);

  exec(
    `npm --no-git-tag-version version ${newVersion} -m "Update version to ${newVersion}"`,
  );

  // Output only the new version
  console.log(newVersion);
} catch (error: any) {
  console.error('An error occurred:', error);
  process.exit(1);
}
