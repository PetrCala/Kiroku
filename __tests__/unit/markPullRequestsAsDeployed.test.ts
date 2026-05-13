/**
 * Verifies the defensive guard added after the staging deploy that posted
 * comments on 58 issues (https://github.com/PetrCala/Kiroku/actions/runs/25757710046).
 * The action must abort without making any API calls when PR_LIST exceeds the cap.
 */
jest.mock('@actions/core');
jest.mock('@actions/github', () => ({
  context: {
    repo: {owner: 'PetrCala', repo: 'Kiroku'},
  },
}));
jest.mock('@github/libs/ActionUtils');
jest.mock('@github/libs/GithubUtils', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __esModule: true,
  default: {
    createComment: jest.fn(),
    getActorWhoClosedIssue: jest.fn(),
    octokit: {
      issues: {listForRepo: jest.fn(), createComment: jest.fn()},
      pulls: {get: jest.fn()},
      repos: {listTags: jest.fn()},
      git: {getCommit: jest.fn()},
    },
  },
}));

// eslint-disable-next-line import/first
import * as core from '@actions/core';
// eslint-disable-next-line import/first
import * as ActionUtils from '@github/libs/ActionUtils';
// eslint-disable-next-line import/first
import GithubUtils from '@github/libs/GithubUtils';

const run =
  require('@github/actions/javascript/markPullRequestsAsDeployed/markPullRequestsAsDeployed') as () => Promise<void>;

const mockedCore = jest.mocked(core);
const mockedActionUtils = jest.mocked(ActionUtils);
const mockedGithubUtils = jest.mocked(GithubUtils);

function setStandardInputs(prList: string[], isProd = false) {
  mockedCore.getInput.mockImplementation((name: string) => {
    const inputs: Record<string, string> = {
      DEPLOY_VERSION: '0.3.11-14-staging',
      ANDROID: 'success',
      IOS: 'success',
    };
    return inputs[name] ?? '';
  });
  mockedActionUtils.getJSONInput.mockImplementation((name: string) => {
    if (name === 'PR_LIST') {
      return prList;
    }
    if (name === 'IS_PRODUCTION_DEPLOY') {
      return isProd;
    }
    return undefined;
  });
}

describe('markPullRequestsAsDeployed safety cap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aborts when PR_LIST exceeds the safety cap and posts no comments', async () => {
    const oversized = Array.from({length: 26}, (_, i) => String(i + 1));
    setStandardInputs(oversized);

    await run();

    expect(mockedCore.setFailed).toHaveBeenCalledTimes(1);
    const failureMessage = String(mockedCore.setFailed.mock.calls[0][0]);
    expect(failureMessage).toContain('26');
    expect(failureMessage).toMatch(/safety limit|cap|aborting/i);

    // The whole point: we should not have reached out to GitHub at all.
    expect(mockedGithubUtils.createComment).not.toHaveBeenCalled();
    expect(mockedGithubUtils.octokit.pulls.get).not.toHaveBeenCalled();
    expect(mockedGithubUtils.octokit.issues.listForRepo).not.toHaveBeenCalled();
    expect(mockedGithubUtils.octokit.repos.listTags).not.toHaveBeenCalled();
  });

  it('aborts for a production deploy with too many PRs (cap applies regardless of environment)', async () => {
    const oversized = Array.from({length: 50}, (_, i) => String(i + 1));
    setStandardInputs(oversized, /* isProd */ true);

    await run();

    expect(mockedCore.setFailed).toHaveBeenCalledTimes(1);
    expect(mockedGithubUtils.createComment).not.toHaveBeenCalled();
    expect(mockedGithubUtils.octokit.issues.listForRepo).not.toHaveBeenCalled();
  });

  it('proceeds past the cap check for a reasonably-sized PR list', async () => {
    setStandardInputs(['1', '2', '3']);
    // Let the per-PR fetch 404 so we exit the loop without needing more mocks.
    (mockedGithubUtils.octokit.repos.listTags as jest.Mock).mockResolvedValue({
      data: [],
    });
    (mockedGithubUtils.octokit.pulls.get as jest.Mock).mockRejectedValue({
      status: 404,
    });

    await run();

    // The cap should NOT have tripped — setFailed was only allowed to fire from
    // the cap path here, so its absence proves the guard let us through.
    expect(mockedCore.setFailed).not.toHaveBeenCalled();
    // We did at least try to look up each PR, confirming the run progressed.
    expect(mockedGithubUtils.octokit.pulls.get).toHaveBeenCalledTimes(3);
  });
});
