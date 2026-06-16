/* eslint-disable @typescript-eslint/naming-convention */
import * as core from '@actions/core';
import {context, getOctokit} from '@actions/github';

type Octokit = ReturnType<typeof getOctokit>;
type Job = Awaited<
  ReturnType<Octokit['rest']['actions']['listJobsForWorkflowRun']>
>['data']['jobs'][number];
type PullRequest = Awaited<
  ReturnType<Octokit['rest']['repos']['listPullRequestsAssociatedWithCommit']>
>['data'][number];

/**
 * The subset of the `workflow_run` webhook payload we read. Triggered runs (via `workflow_dispatch`
 * + RUN_ID) are normalised into this same shape from the REST `getWorkflowRun` response.
 */
type WorkflowRun = {
  id: number;
  workflow_id: number;
  head_branch: string | null;
  head_sha: string;
  html_url: string;
  run_number: number;
  actor: {login: string} | null;
  head_commit: {id: string} | null;
};

const KIROKU_BOT = 'KirokuAdmin';
const DEFAULT_BRANCH = 'master';

// The aggregator job always fails when a child reusable workflow fails, so it must never be blamed.
const AGGREGATOR_JOB = 'confirmPassingBuild';

// Discord rejects a webhook `content` longer than 2000 characters.
const DISCORD_CONTENT_LIMIT = 2000;
const MAX_ERROR_CHARS_PER_JOB = 600;

/**
 * Given the PRs associated with a commit on the target branch, find the one that was actually merged
 * into that branch. `listPullRequestsAssociatedWithCommit` also returns open PRs that merged the
 * target branch into their feature branch, so we must filter to merged PRs on the correct base.
 */
function getMergedPR(
  associatedPRs: PullRequest[],
  targetBranch: string,
): PullRequest | undefined {
  return associatedPRs.find(
    pr => pr.merged_at !== null && pr.base.ref === targetBranch,
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

/** Resolve the run to report on from either the `workflow_run` event payload or the RUN_ID input. */
async function resolveWorkflowRun(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<WorkflowRun | undefined> {
  const eventRun = context.payload.workflow_run as WorkflowRun | undefined;
  if (eventRun?.id) {
    return eventRun;
  }

  const runIdInput = core.getInput('RUN_ID');
  if (!runIdInput) {
    return undefined;
  }

  const {data} = await octokit.rest.actions.getWorkflowRun({
    owner,
    repo,
    run_id: Number(runIdInput),
  });
  return {
    id: data.id,
    workflow_id: data.workflow_id,
    head_branch: data.head_branch,
    head_sha: data.head_sha,
    html_url: data.html_url,
    run_number: data.run_number,
    actor: data.actor ? {login: data.actor.login} : null,
    head_commit: data.head_commit ? {id: data.head_commit.id} : null,
  };
}

/**
 * Best-effort: map each job name to its conclusion on the previous non-bot run of the same workflow.
 * Used purely to enrich the message ("was green before"), never to suppress a notification.
 */
async function getPreviousRunConclusions(
  octokit: Octokit,
  owner: string,
  repo: string,
  workflowRun: WorkflowRun,
): Promise<Map<string, string | null>> {
  const conclusions = new Map<string, string | null>();
  try {
    const {data} = await octokit.rest.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflowRun.workflow_id,
      per_page: 100,
    });
    const candidates = data.workflow_runs.filter(
      candidate =>
        candidate.actor?.login !== KIROKU_BOT &&
        candidate.status !== 'cancelled',
    );
    const currentIndex = candidates.findIndex(
      candidate => candidate.id === workflowRun.id,
    );
    const previousRun =
      currentIndex >= 0 ? candidates[currentIndex + 1] : undefined;
    if (!previousRun) {
      return conclusions;
    }
    const {data: previousJobs} =
      await octokit.rest.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: previousRun.id,
      });
    previousJobs.jobs.forEach(job => conclusions.set(job.name, job.conclusion));
  } catch (error) {
    core.warning(
      `Could not compare against the previous run: ${String(error)}`,
    );
  }
  return conclusions;
}

/** Pull the check-run annotations for a failed job and render them as a short error blob. */
async function getJobErrorText(
  octokit: Octokit,
  owner: string,
  repo: string,
  job: Job,
): Promise<string> {
  try {
    const {data: annotations} = await octokit.rest.checks.listAnnotations({
      owner,
      repo,
      check_run_id: job.id,
    });
    const lines = annotations
      .map(annotation =>
        `${annotation.annotation_level ?? 'note'}: ${annotation.message ?? ''}`.trim(),
      )
      .filter(line => line.length > 0);
    return truncate(lines.join('\n'), MAX_ERROR_CHARS_PER_JOB);
  } catch (error) {
    core.warning(
      `Could not fetch annotations for job "${job.name}": ${String(error)}`,
    );
    return '';
  }
}

async function postToDiscord(
  webhookUrl: string,
  content: string,
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({content: truncate(content, DISCORD_CONTENT_LIMIT)}),
  });
  if (!response.ok) {
    core.setFailed(
      `Discord webhook responded with ${response.status} ${response.statusText}`,
    );
  }
}

async function run(): Promise<void> {
  const token = core.getInput('GITHUB_TOKEN', {required: true});
  const webhookUrl = core.getInput('DISCORD_WEBHOOK_URL', {required: true});
  const octokit = getOctokit(token);
  const {owner, repo} = context.repo;

  const workflowRun = await resolveWorkflowRun(octokit, owner, repo);
  if (!workflowRun) {
    core.setFailed(
      'No workflow run to process: missing workflow_run payload and RUN_ID input.',
    );
    return;
  }

  const runUrl = workflowRun.html_url;
  const branch = workflowRun.head_branch ?? DEFAULT_BRANCH;
  const mergedBy = workflowRun.actor?.login ?? 'unknown';

  // Identify the merged PR that introduced this commit (best-effort).
  const headSha = workflowRun.head_commit?.id ?? workflowRun.head_sha;
  let pr: PullRequest | undefined;
  try {
    const {data: associatedPRs} =
      await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: headSha,
      });
    pr = getMergedPR(associatedPRs, branch);
  } catch (error) {
    core.warning(
      `Could not look up the merged PR for ${headSha}: ${String(error)}`,
    );
  }

  // Collect the failing jobs (excluding the aggregator) and enrich each with annotations + regression status.
  const {data: jobsData} = await octokit.rest.actions.listJobsForWorkflowRun({
    owner,
    repo,
    run_id: workflowRun.id,
  });
  const failedJobs = jobsData.jobs.filter(
    job => job.conclusion === 'failure' && job.name !== AGGREGATOR_JOB,
  );
  const previousConclusions = await getPreviousRunConclusions(
    octokit,
    owner,
    repo,
    workflowRun,
  );

  const jobReports = await Promise.all(
    failedJobs.map(async job => ({
      name: job.name,
      url: job.html_url,
      newlyBroke: previousConclusions.get(job.name) === 'success',
      error: await getJobErrorText(octokit, owner, repo, job),
    })),
  );

  // Phase-2 seam: structured summary a future self-heal step can consume.
  core.setOutput(
    'failure_summary',
    JSON.stringify({
      runId: workflowRun.id,
      runUrl,
      branch,
      headSha,
      pr: pr
        ? {
            number: pr.number,
            url: pr.html_url,
            author: pr.user?.login ?? 'unknown',
          }
        : null,
      failedJobs: jobReports.map(({name, url, newlyBroke}) => ({
        name,
        url,
        newlyBroke,
      })),
    }),
  );

  // Build the enriched Discord message. Always post on a failed run, even when the culprit is unknown.
  const lines: string[] = [
    `💥 **${branch}** pipeline failed. Run: [#${workflowRun.run_number}](${runUrl})`,
    '',
  ];

  if (pr) {
    lines.push(
      `**Blamed PR:** ${pr.html_url} by @${pr.user?.login ?? 'unknown'} (merged by @${mergedBy})`,
    );
  } else {
    lines.push(
      `**Blamed PR:** could not be determined (merged by @${mergedBy})`,
    );
  }
  lines.push('');

  if (jobReports.length === 0) {
    lines.push('No individual failed job was detected. Check the run logs.');
  } else {
    lines.push('**Failing jobs:**');
    jobReports.forEach(job => {
      const regression = job.newlyBroke
        ? ' (was green on the previous run)'
        : '';
      lines.push(`• **${job.name}**${regression} ([logs](${job.url}))`);
      if (job.error) {
        lines.push(`\`\`\`\n${job.error}\n\`\`\``);
      }
    });
  }

  await postToDiscord(webhookUrl, lines.join('\n'));
  core.info(
    `Reported ${jobReports.length} failed job(s) for run ${workflowRun.id} to Discord.`,
  );
}

if (require.main === module) {
  run().catch((error: Error) => {
    console.error('Failed to process workflow failure:', error);
    core.setFailed(error.message);
  });
}

export default run;
export {getMergedPR};
export type {PullRequest};
