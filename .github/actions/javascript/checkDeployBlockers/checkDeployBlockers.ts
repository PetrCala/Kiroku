/* eslint-disable @typescript-eslint/naming-convention */
import * as core from '@actions/core';
import CONST from '@github/libs/CONST';
import GithubUtils from '@github/libs/GithubUtils';

const run = function (): Promise<void> {
  const issueNumber = Number(core.getInput('ISSUE_NUMBER', {required: true}));

  console.log(`Fetching issue number ${issueNumber}`);

  return GithubUtils.octokit.issues
    .get({
      owner: CONST.GITHUB_OWNER,
      repo: CONST.APP_REPO,
      issue_number: issueNumber,
    })
    .then(({data}) => {
      console.log('Checking for unchecked deploy checklist items', data);

      // Check the issue description to see if there are any unchecked checklist items.
      const uncheckedBoxRegex = /-\s\[\s]\s/;
      if (uncheckedBoxRegex.test(data.body ?? '')) {
        console.log('An unchecked deploy checklist item was found.');
        core.setOutput('HAS_DEPLOY_BLOCKERS', true);
        return;
      }

      return GithubUtils.getAllComments(issueNumber);
    })
    .then(comments => {
      console.log(
        'Checking the last comment for the :shipit: seal of approval',
        comments,
      );

      // If comments is undefined that means we found an unchecked item in the
      // issue description, so there's nothing more to do but return early.
      if (comments === undefined) {
        return;
      }

      // If there are no comments, then we have not yet gotten the :shipit: seal of approval.
      if (comments.length === 0) {
        console.log('No comments found on issue');
        core.setOutput('HAS_DEPLOY_BLOCKERS', true);
        return;
      }

      console.log(
        'Verifying that the last comment is the :shipit: seal of approval',
      );
      const lastComment = comments.pop();
      const shipItRegex = /^:shipit:/;
      if (!shipItRegex.exec(lastComment ?? '')) {
        console.log('The last comment on the issue was not :shipit');
        core.setOutput('HAS_DEPLOY_BLOCKERS', true);
      } else {
        console.log('Everything looks good, there are no deploy blockers!');
        core.setOutput('HAS_DEPLOY_BLOCKERS', false);
      }
    })
    .catch((error: string | Error) => {
      console.error(
        'A problem occurred while trying to communicate with the GitHub API',
        error,
      );
      core.setFailed(error);
    });
};

if (require.main === module) {
  run();
}

export default run;
