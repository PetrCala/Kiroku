/**
 * @jest-environment node
 */

/**
 * End-to-end smoke test for the shallow-clone fix.
 *
 * Runs the full getPullRequestsMergedBetween pipeline against a real temporary
 * git repo (shallow-cloned via file://) and verifies only the PRs merged after
 * fromTag are returned.
 *
 * The complementary structural test (which command sequence is issued) lives in
 * GitUtilsStructural.test.ts, which uses jest.mock to intercept child_process.
 */
import * as childProcess from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import GitUtils from '@github/libs/GitUtils';

const isGitAvailable = (() => {
  try {
    childProcess.execSync('git --version', {stdio: 'ignore'});
    return true;
  } catch {
    return false;
  }
})();

const describeIfGit = isGitAvailable ? describe : describe.skip;

describeIfGit('getPullRequestsMergedBetween — end-to-end smoke test', () => {
  jest.setTimeout(60_000);

  let originalCwd: string;
  let tmpRoot: string;
  let remoteDir: string;

  function execIn(cwd: string, command: string) {
    childProcess.execSync(command, {cwd, stdio: 'pipe'});
  }

  function fakePRMergeCommit(cwd: string, prNumber: number) {
    const file = `pr${prNumber}.txt`;
    fs.writeFileSync(path.join(cwd, file), `pr ${prNumber}\n`);
    execIn(cwd, `git add ${file}`);
    execIn(
      cwd,
      `git commit -m "Merge pull request #${prNumber} from PetrCala/feature-${prNumber}"`,
    );
  }

  beforeAll(() => {
    originalCwd = process.cwd();
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kiroku-gitutils-'));
    remoteDir = path.join(tmpRoot, 'remote.git');
    const seedDir = path.join(tmpRoot, 'seed');

    fs.mkdirSync(remoteDir);
    fs.mkdirSync(seedDir);

    execIn(remoteDir, 'git init --bare -b master');

    execIn(seedDir, 'git init -b master');
    execIn(seedDir, 'git config user.name "Kiroku Test"');
    execIn(seedDir, 'git config user.email "test@kiroku.test"');
    execIn(seedDir, 'git config commit.gpgsign false');
    execIn(seedDir, `git remote add origin "${remoteDir}"`);

    fs.writeFileSync(path.join(seedDir, 'README.md'), 'init\n');
    execIn(seedDir, 'git add README.md');
    execIn(seedDir, 'git commit -m "init"');

    // History: init → PR#50 → [0.3.10-0] → PR#100 → [0.3.11-1-staging] → PR#200 → [0.3.11-2-staging]
    //
    // 0.3.10-0 is the tag getPreviousVersion('0.3.11-1-staging', PATCH) resolves to.
    // Adding it here means getPreviousExistingTag returns on the first check instead
    // of iterating 100 times through non-existent versions.
    fakePRMergeCommit(seedDir, 50);
    execIn(seedDir, 'git tag 0.3.10-0');
    fakePRMergeCommit(seedDir, 100);
    execIn(seedDir, 'git tag 0.3.11-1-staging');
    fakePRMergeCommit(seedDir, 200);
    execIn(seedDir, 'git tag 0.3.11-2-staging');

    execIn(seedDir, 'git push origin master');
    execIn(seedDir, 'git push origin --tags');
  });

  afterAll(() => {
    process.chdir(originalCwd);
    if (tmpRoot && fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, {recursive: true, force: true});
    }
  });

  beforeEach(() => {
    process.chdir(originalCwd);
  });

  it('returns ONLY the PRs merged between the two staging tags', async () => {
    const ciCloneDir = fs.mkdtempSync(path.join(tmpRoot, 'ci-'));
    // --no-local forces a true shallow clone over the file:// protocol so the
    // local-clone hardlink shortcut doesn't bypass --depth.
    childProcess.execSync(
      `git clone --depth=1 --no-local "file://${remoteDir}" "${ciCloneDir}"`,
      {stdio: 'pipe'},
    );
    execIn(ciCloneDir, 'git config user.name "Kiroku Test"');
    execIn(ciCloneDir, 'git config user.email "test@kiroku.test"');
    process.chdir(ciCloneDir);

    const prs = await GitUtils.getPullRequestsMergedBetween(
      '0.3.11-1-staging',
      '0.3.11-2-staging',
    );

    expect(prs).toEqual([200]);
    expect(prs).not.toContain(50);
    expect(prs).not.toContain(100);
  });
});
