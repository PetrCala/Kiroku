import * as core from '@actions/core';
import * as github from '@actions/github';
import type {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/parameters-and-response-types';
import {getJSONInput} from '@github/libs/ActionUtils';
import GithubUtils from '@github/libs/GithubUtils';
import GitUtils from '@github/libs/GitUtils';

type Release = RestEndpointMethodTypes['repos']['listReleases']['response']['data'][number];

function isReleaseValidBaseForEnvironment(release: Release, isProductionDeploy: boolean) {
    return !isProductionDeploy || !release.prerelease;
}

async function getPreviousDeployTag(inputTag: string, isProductionDeploy: boolean) {
    const releases = await GithubUtils.paginate(GithubUtils.octokit.repos.listReleases, {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        per_page: 100,
    });

    let foundCurrentRelease = false;
    for (const release of releases) {
        if (release.draft) {
            continue;
        }

        if (release.tag_name === inputTag) {
            foundCurrentRelease = true;
            continue;
        }

        if (!foundCurrentRelease || !isReleaseValidBaseForEnvironment(release, isProductionDeploy)) {
            continue;
        }

        return release.tag_name;
    }

    throw new Error(`Could not find a prior ${isProductionDeploy ? 'production' : 'staging'} deploy release for ${inputTag}`);
}

async function run() {
    try {
        const inputTag = core.getInput('TAG', {required: true});
        const isProductionDeploy = !!getJSONInput('IS_PRODUCTION_DEPLOY', {required: false}, false);
        const deployEnv = isProductionDeploy ? 'production' : 'staging';

        console.log(`Looking for PRs deployed to ${deployEnv} in ${inputTag}...`);

        const priorTag = await getPreviousDeployTag(inputTag, isProductionDeploy);
        console.log(`Looking for PRs deployed to ${deployEnv} between ${priorTag} and ${inputTag}`);
        const prList = await GitUtils.getPullRequestsMergedBetween(priorTag, inputTag);
        console.log('Found the pull request list: ', prList);
        core.setOutput('PR_LIST', prList);
    } catch (error) {
        console.error((error as Error).message);
        core.setFailed(error as Error);
    }
}

if (require.main === module) {
    run();
}

export default run;
