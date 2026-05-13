/**
 * @jest-environment node
 */

/**
 * Structural regression test for the shallow-clone fetch bug that posted
 * comments on 58 unrelated issues:
 * https://github.com/PetrCala/Kiroku/actions/runs/25757710046
 *
 * Intercepts the git commands issued by getPullRequestsMergedBetween and
 * asserts that the toTag fetch uses fromTag as its --shallow-exclude boundary.
 * This is what actually fixes the bug: it forces git to resolve the ancestry
 * chain between the two tags in a shallow CI clone.
 *
 * jest.mock is used (not jest.spyOn) so the child_process bindings inside
 * GitUtils are intercepted at module-load time regardless of how Babel
 * transforms the named imports.
 */

import type {ChildProcess} from 'child_process';
import {EventEmitter} from 'events';

jest.mock('child_process', () => ({
  execSync: jest.fn().mockReturnValue(Buffer.from('')),
  spawn: jest.fn(),
}));

// Imports must come after jest.mock (hoisting handles the ordering at runtime,
// but placing them here keeps the source readable and avoids lint warnings).
// eslint-disable-next-line import/first
import * as cp from 'child_process';
// eslint-disable-next-line import/first
import GitUtils from '@github/libs/GitUtils';

describe('getPullRequestsMergedBetween — fetch command sequence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // spawn drives the final `git log` step; return a process that closes
    // cleanly with empty stdout so the parser produces an empty list.
    (cp.spawn as jest.Mock).mockImplementation((): ChildProcess => {
      const proc = new EventEmitter() as ChildProcess;
      (proc as unknown as {stdout: EventEmitter}).stdout = new EventEmitter();
      (proc as unknown as {stderr: EventEmitter}).stderr = new EventEmitter();
      setImmediate(() => proc.emit('close', 0));
      return proc;
    });
  });

  it('fetches toTag with --shallow-exclude=<fromTag>', async () => {
    await GitUtils.getPullRequestsMergedBetween(
      '0.3.11-13-staging',
      '0.3.11-14-staging',
    );

    const calls: string[] = (cp.execSync as jest.Mock).mock.calls.map(
      ([cmd]: [string | Buffer]) => String(cmd),
    );

    const toTagFetch = calls.find(c =>
      c.includes('git fetch origin tag 0.3.11-14-staging'),
    );
    expect(toTagFetch).toBeDefined();
    // The critical guarantee: the toTag fetch must scope itself to fromTag.
    expect(toTagFetch).toContain('--shallow-exclude=0.3.11-13-staging');
  });
});
