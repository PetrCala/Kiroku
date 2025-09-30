# Android Large Runner Setup

This guide explains how to provision a GitHub-hosted larger runner and how it is used by the Android build workflow.

## 1. Provision the larger runner

1. Navigate to the repository in GitHub and open **Settings → Actions → Runners**.
2. Click **New runner** and select **GitHub-hosted**.
3. Choose **Linux** as the operating system, then pick a machine size that provides the required resources (for example, the `large` 8-core / 32 GB RAM option).
4. Assign the runner to the repository (or to a runner group that the repository can access) and define a label such as `android-large`.
5. Save the runner. GitHub will provision it automatically; no manual installation steps are required for GitHub-hosted larger runners.

## 2. Permissions and secrets

No additional secrets are needed for the runner itself, but ensure the repository already has the Android signing credentials and AWS secrets required by the workflow.

## 3. Workflow changes

The Android job in `.github/workflows/testBuild.yml` now targets the `android-large` label on a self-hosted runner. GitHub-hosted larger runners expose the `self-hosted` label, so both labels are required in the `runs-on` stanza:

```yaml
runs-on:
  - self-hosted
  - android-large
```

When a job requests this combination, GitHub will dispatch it to the new large runner you configured above. If you need to rename the runner or use a different label, update the workflow accordingly.

## 4. Operational tips

- Larger runners are billed differently from standard `ubuntu-latest` machines. Monitor usage in **Settings → Actions → Billing**.
- Consider keeping the Gradle cache warm using the `actions/cache` action if build times remain high.
- If no large runner is available when the job is triggered, the workflow will wait in the queue until one becomes available. You can pause or cancel queued jobs from the Actions tab if necessary.
