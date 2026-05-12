import * as core from '@actions/core';
import {format} from 'date-fns';
import {readFileSync} from 'fs';
import CONST from '@github/libs/CONST';
import GithubUtils from '@github/libs/GithubUtils';
import type {StagingDeployCashData} from '@github/libs/GithubUtils';
import GitUtils from '@github/libs/GitUtils';

type IssuesCreateResponse = Awaited<
  ReturnType<typeof GithubUtils.octokit.issues.create>
>['data'];

type PackageJson = {
  version: string;
};

async function run(): Promise<IssuesCreateResponse | void> {
  // Note: require('package.json').version does not work because ncc will resolve that to a plain string at compile time
  const packageJson = JSON.parse(
    readFileSync('package.json', 'utf8'),
  ) as PackageJson;
  const newVersionTag =
    core.getInput('TAG', {required: false}) || packageJson.version;

  try {
    // Start by fetching the list of recent deploy checklists and open deploy blockers.
    const {data: recentDeployChecklists} =
      await GithubUtils.octokit.issues.listForRepo({
        log: console,
        owner: CONST.GITHUB_OWNER,
        repo: CONST.APP_REPO,
        labels: CONST.LABELS.STAGING_DEPLOY,
        state: 'all',
      });
    const {data: openDeployBlockers} =
      await GithubUtils.octokit.issues.listForRepo({
        log: console,
        owner: CONST.GITHUB_OWNER,
        repo: CONST.APP_REPO,
        labels: CONST.LABELS.DEPLOY_BLOCKER,
      });

    // Look at the state of the most recent deploy checklist,
    // if it is open then we'll update the existing one, otherwise, we'll create a new one.
    const mostRecentChecklist = recentDeployChecklists[0];
    const shouldCreateNewDeployChecklist =
      !mostRecentChecklist || mostRecentChecklist.state !== 'open';
    const previousChecklist = shouldCreateNewDeployChecklist
      ? mostRecentChecklist
      : recentDeployChecklists[1];
    if (shouldCreateNewDeployChecklist) {
      console.log(
        'Latest deploy checklist is closed, creating a new one.',
        mostRecentChecklist,
      );
    } else {
      console.log(
        'Latest deploy checklist is open, updating it instead of creating a new one.',
        'Current:',
        mostRecentChecklist,
        'Previous:',
        previousChecklist,
      );
    }

    // Parse the data from the previous and current checklists into the format used to generate the checklist
    const previousChecklistData = previousChecklist
      ? GithubUtils.getStagingDeployCashData(previousChecklist)
      : undefined;
    const currentChecklistData: StagingDeployCashData | undefined =
      shouldCreateNewDeployChecklist
        ? undefined
        : GithubUtils.getStagingDeployCashData(mostRecentChecklist);

    // Find the list of PRs merged between the current checklist and the previous checklist
    const mergedPRs = await GitUtils.getPullRequestsMergedBetween(
      previousChecklistData?.tag ?? '',
      newVersionTag,
    );

    // Next, we generate the checklist body
    let checklistBody = '';
    let checklistAssignees: string[] = [];
    if (shouldCreateNewDeployChecklist) {
      const stagingDeployCashBodyAndAssignees =
        await GithubUtils.generateStagingDeployCashBodyAndAssignees(
          newVersionTag,
          mergedPRs.map(value =>
            GithubUtils.getPullRequestURLFromNumber(value),
          ),
          [],
          openDeployBlockers.map(deployBlocker => deployBlocker.html_url),
        );
      if (stagingDeployCashBodyAndAssignees) {
        checklistBody = stagingDeployCashBodyAndAssignees.issueBody;
        checklistAssignees =
          stagingDeployCashBodyAndAssignees.issueAssignees.filter(
            Boolean,
          ) as string[];
      }
    } else {
      // Generate the updated PR list, preserving the previous state of `isVerified` for existing PRs
      const PRList = mergedPRs.map(prNum => {
        const indexOfPRInCurrentChecklist =
          currentChecklistData?.PRList.findIndex(pr => pr.number === prNum) ??
          -1;
        const isVerified =
          indexOfPRInCurrentChecklist >= 0
            ? currentChecklistData?.PRList[indexOfPRInCurrentChecklist]
                .isVerified
            : false;
        return {
          number: prNum,
          url: GithubUtils.getPullRequestURLFromNumber(prNum),
          isVerified,
        };
      });

      // Generate the deploy blocker list, preserving the previous state of `isResolved`
      // First, make sure we include all current deploy blockers
      const deployBlockers = openDeployBlockers.map(deployBlocker => {
        const indexInCurrentChecklist =
          currentChecklistData?.deployBlockers.findIndex(
            item => item.number === deployBlocker.number,
          ) ?? -1;
        const isResolved =
          indexInCurrentChecklist >= 0
            ? currentChecklistData?.deployBlockers[indexInCurrentChecklist]
                .isResolved
            : false;
        return {
          number: deployBlocker.number,
          url: deployBlocker.html_url,
          isResolved,
        };
      });

      // Then include any demoted or closed blockers, and check them off automatically.
      currentChecklistData?.deployBlockers.forEach(deployBlocker => {
        const isStillOpen =
          deployBlockers.findIndex(
            openBlocker => openBlocker.number === deployBlocker.number,
          ) >= 0;
        if (isStillOpen) {
          return;
        }

        deployBlockers.push({
          ...deployBlocker,
          isResolved: true,
        });
      });

      const stagingDeployCashBodyAndAssignees =
        await GithubUtils.generateStagingDeployCashBodyAndAssignees(
          newVersionTag,
          PRList.map(pr => pr.url),
          PRList.filter(pr => pr.isVerified).map(pr => pr.url),
          deployBlockers.map(blocker => blocker.url),
          deployBlockers
            .filter(blocker => blocker.isResolved)
            .map(blocker => blocker.url),
          currentChecklistData?.isIOSSmokeChecked ?? false,
          currentChecklistData?.isAndroidSmokeChecked ?? false,
          currentChecklistData?.isFirebaseChecked ?? false,
          currentChecklistData?.isGHStatusChecked ?? false,
        );
      if (stagingDeployCashBodyAndAssignees) {
        checklistBody = stagingDeployCashBodyAndAssignees.issueBody;
        checklistAssignees =
          stagingDeployCashBodyAndAssignees.issueAssignees.filter(
            Boolean,
          ) as string[];
      }
    }

    // Finally, create or update the checklist
    const defaultPayload = {
      owner: CONST.GITHUB_OWNER,
      repo: CONST.APP_REPO,
      body: checklistBody,
    };

    if (shouldCreateNewDeployChecklist) {
      const {data: newChecklist} = await GithubUtils.octokit.issues.create({
        ...defaultPayload,
        title: `Deploy Checklist: Kiroku ${format(new Date(), CONST.DATE_FORMAT_STRING)}`,
        labels: [CONST.LABELS.STAGING_DEPLOY],
        assignees: checklistAssignees,
      });
      console.log(
        `Successfully created new deploy checklist! 🎉 ${newChecklist.html_url}`,
      );
      return newChecklist;
    }

    const {data: updatedChecklist} = await GithubUtils.octokit.issues.update({
      ...defaultPayload,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      issue_number: currentChecklistData?.number ?? 0,
    });
    console.log(
      `Successfully updated deploy checklist! 🎉 ${updatedChecklist.html_url}`,
    );
    return updatedChecklist;
  } catch (err: unknown) {
    console.error('An unknown error occurred!', err);
    core.setFailed(err as Error);
  }
}

if (require.main === module) {
  run();
}

export default run;
