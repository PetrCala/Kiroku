import type {CommitType} from '@github/libs/GitUtils';
import GitUtils from '@github/libs/GitUtils';
import {
  getPreviousVersion,
  SEMANTIC_VERSION_LEVELS,
} from '@github/libs/versionUpdater';

type ExampleDataType = {
  input: CommitType[];
  expectedOutput: number[];
};

const data: ExampleDataType[] = [
  {
    input: [],
    expectedOutput: [],
  },
  {
    input: [
      {
        commit: '1',
        subject: 'Some random commit message',
        authorName: 'test@gmail.com',
      },
    ],
    expectedOutput: [],
  },
  {
    input: [
      {
        commit: '1',
        subject: 'Start adding StagingDeployCash logic',
        authorName: 'test@gmail.com',
      },
      {commit: '2', subject: 'Setting up bones', authorName: 'test@gmail.com'},
      {
        commit: '3',
        subject:
          'Merge pull request #337 from Kiroku/francoisUpdateQbdSyncManager',
        authorName: 'test@gmail.com',
      },
      {
        commit: '4',
        subject: 'Merge pull request #336 from Kiroku/andrew-pr-cla',
        authorName: 'test@gmail.com',
      },
      {
        commit: '5',
        subject: 'Update QBD Sync Manager version',
        authorName: 'test@gmail.com',
      },
      {
        commit: '6',
        subject: 'Only run CLA on PR comments or events',
        authorName: 'test@gmail.com',
      },
      {
        commit: '7',
        subject: 'Merge pull request #331 from Kiroku/marcaaron-killMoment',
        authorName: 'test@gmail.com',
      },
      {
        commit: '8',
        subject: 'Merge pull request #330 from Kiroku/andrew-cla-update',
        authorName: 'test@gmail.com',
      },
      {
        commit: '9',
        subject:
          'Merge pull request #333 from Kiroku/Rory-AddOnOffSwitchTooltip',
        authorName: 'test@gmail.com',
      },
      {
        commit: '10',
        subject: 'Setup OnOffSwitch component with tooltips',
        authorName: 'test@gmail.com',
      },
      {
        commit: '11',
        subject: 'Merge pull request #332 from Kiroku/alex-mechler-patch-1',
        authorName: 'test@gmail.com',
      },
      {
        commit: '12',
        subject: 'Return to old hash-based deploy instrcutions',
        authorName: 'test@gmail.com',
      },
      {
        commit: '12',
        subject: 'Remove DEFAULT_START_DATE & DEFAULT_END_DATE altogether',
        authorName: 'test@gmail.com',
      },
    ],
    expectedOutput: [337, 336, 331, 330, 333, 332],
  },
  {
    input: [
      {
        commit: '1',
        subject:
          'Merge pull request #1521 from parasharrajat/parasharrajat/pdf-render',
        authorName: 'test@gmail.com',
      },
      {
        commit: '3',
        subject: 'Update version to 1.0.1-470',
        authorName: 'test@gmail.com',
      },
      {
        commit: '4',
        subject: '[IS-1500] Updated textalignInput utility',
        authorName: 'test@gmail.com',
      },
      {
        commit: '5',
        subject: 'fix: set pdf width on large screens',
        authorName: 'test@gmail.com',
      },
    ],
    expectedOutput: [1521],
  },
  {
    // Commits authored by KirokuAdmin (release bumps) should be excluded even if
    // their subject looks like a PR merge — otherwise we'd comment on the deploy bot's own work.
    input: [
      {
        commit: '1',
        subject: 'Merge pull request #500 from PetrCala/some-feature',
        authorName: 'KirokuAdmin',
      },
      {
        commit: '2',
        subject: 'Merge pull request #501 from PetrCala/another-feature',
        authorName: 'test@gmail.com',
      },
    ],
    expectedOutput: [501],
  },
  {
    // The regex's negative lookahead must filter out Expensify cherry-pick-staging
    // merge commits so they don't pollute the deploy comment list.
    input: [
      {
        commit: '1',
        subject:
          'Merge pull request #600 from Expensify/feature-cherry-pick-staging',
        authorName: 'test@gmail.com',
      },
      {
        commit: '2',
        subject: 'Merge pull request #601 from PetrCala/regular-pr',
        authorName: 'test@gmail.com',
      },
    ],
    expectedOutput: [601],
  },
  {
    // A PR that appears twice in the commit window (e.g. direct merge plus a
    // cherry-pick into a release branch) must be removed — it was already deployed.
    input: [
      {
        commit: '1',
        subject: 'Merge pull request #700 from PetrCala/feature',
        authorName: 'test@gmail.com',
      },
      {
        commit: '2',
        subject: 'Merge pull request #701 from PetrCala/other-feature',
        authorName: 'test@gmail.com',
      },
      {
        commit: '3',
        subject: 'Merge pull request #700 from PetrCala/feature',
        authorName: 'test@gmail.com',
      },
    ],
    expectedOutput: [701],
  },
];

describe('GitUtils', () => {
  describe.each(data)('getValidMergedPRs', exampleCase => {
    test('getValidMergedPRs', () => {
      const result = GitUtils.getValidMergedPRs(exampleCase.input);
      expect(result).toStrictEqual(exampleCase.expectedOutput);
    });
  });
});

describe('getPreviousVersion — floor behaviour', () => {
  it('does not go below 0.0.0-0', () => {
    const result = getPreviousVersion('0.0.0-0', SEMANTIC_VERSION_LEVELS.PATCH);
    expect(result).toBe('0.0.0-0');
  });

  it('returns 0.0.0-0 when decrementing major from 0', () => {
    const result = getPreviousVersion('0.0.0-0', SEMANTIC_VERSION_LEVELS.MAJOR);
    expect(result).toBe('0.0.0-0');
  });

  it('does not produce NaN values when decrementing a 0.x.x version to the floor', () => {
    const result = getPreviousVersion('0.3.0-0', SEMANTIC_VERSION_LEVELS.PATCH);
    expect(result).not.toContain('NaN');
    expect(result).not.toContain('undefined');
  });

  it('is idempotent at the floor — calling it twice returns the same value', () => {
    const floor = getPreviousVersion('0.0.0-0', SEMANTIC_VERSION_LEVELS.PATCH);
    const floorAgain = getPreviousVersion(floor, SEMANTIC_VERSION_LEVELS.PATCH);
    expect(floor).toBe(floorAgain);
  });
});
