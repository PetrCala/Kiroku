import {
  exec as execWithCallback,
  execSync as originalExecSync,
} from 'child_process';
import type {
  ExecSyncOptionsWithStringEncoding,
  ExecOptions as ExecWithCallbackOptions,
} from 'child_process';
import {promisify} from 'util';
import {error as logError, warn as logWarn} from './Logger';

type ExecOptions = Omit<ExecWithCallbackOptions, 'encoding'> & {
  cwd?: ExecWithCallbackOptions['cwd'];
};
function exec(command: string, options?: ExecOptions) {
  const optionsWithEncoding = {
    encoding: 'utf8',
    cwd: process.cwd(),
    ...options,
  };

  return promisify(execWithCallback)(command, optionsWithEncoding);
}

type ExecSyncOptions = Omit<
  ExecSyncOptionsWithStringEncoding,
  'encoding' | 'cwd'
> & {
  encoding?: ExecSyncOptionsWithStringEncoding['encoding'];
  cwd?: ExecSyncOptionsWithStringEncoding['cwd'];
};

function execSync(command: string, options?: ExecSyncOptions) {
  const optionsWithEncoding: ExecSyncOptionsWithStringEncoding = {
    ...options,
    encoding: 'utf8',
    cwd: process.cwd(),
  };

  return originalExecSync(command, optionsWithEncoding);
}

const IS_CI = process.env.CI === 'true';
const GITHUB_BASE_REF = process.env.GITHUB_BASE_REF as string | undefined;

/**
 * Represents a single changed line in a git diff.
 * Only added and removed lines are tracked (context lines are counted separately).
 */
type DiffLine = {
  number: number;
  type: 'added' | 'removed';
  content: string;
};

/**
 * Represents a hunk in a git diff (a contiguous block of changes).
 */
type DiffHunk = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
  contextLineCount: number;
};

/**
 * Represents a structured git diff for a single file.
 */
type FileDiff = {
  filePath: string;
  diffType: 'added' | 'removed' | 'modified' | 'renamed';
  previousFilePath?: string;
  hunks: DiffHunk[];
  addedLines: Set<number>;
  removedLines: Set<number>;
  modifiedLines: Set<number>;
};

/**
 * Represents the result of a git diff operation.
 */
type DiffResult = {
  files: FileDiff[];
  hasChanges: boolean;
};

type ChangedFile = {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  previousFilename?: string;
};

/**
 * Utility class for git operations.
 */
class Git {
  /**
   * Execute a git diff between two refs and return structured diff information.
   *
   * @param fromRef - The starting reference (commit, branch, tag, etc.)
   * @param toRef - The ending reference (defaults to working directory if not provided)
   * @param filePaths - Optional specific file path(s) to diff (relative to git repo root)
   * @returns Structured diff result with line numbers and change information
   * @throws Error when git command fails (invalid refs, not a git repo, file not found, etc.)
   */
  static diff(
    fromRef: string,
    toRef?: string,
    filePaths?: string | string[],
  ): DiffResult {
    // Build git diff command (with 0 context lines for easier parsing, -M for rename detection)
    let command = `git diff -U0 -M ${fromRef}`;
    if (toRef) {
      command += ` ${toRef}`;
    }
    if (filePaths) {
      const pathsArray = Array.isArray(filePaths) ? filePaths : [filePaths];
      const quotedPaths = pathsArray.map(filePath => `"${filePath}"`).join(' ');
      command += ` -- ${quotedPaths}`;
    }

    // Execute git diff with unified format - let errors bubble up
    const diffOutput = execSync(command);

    return Git.parseDiff(diffOutput);
  }

  /**
   * Parse git diff output into structured format.
   *
   * @param diffOutput - Raw git diff output string
   * @returns Structured diff result with line numbers and change information
   */
  static parseDiff(diffOutput: string): DiffResult {
    // Parse the diff output inline
    if (!diffOutput.trim()) {
      return {
        files: [],
        hasChanges: false,
      };
    }

    const lines = diffOutput.split('\n');
    const files: FileDiff[] = [];
    let currentFile: FileDiff | null = null;
    let currentHunk: DiffHunk | null = null;
    let oldFilePath: string | null = null;
    let renameFromPath: string | null = null;

    for (const line of lines) {
      // File header: diff --git a/file b/file
      if (line.startsWith('diff --git')) {
        if (currentFile) {
          if (currentHunk) {
            currentFile.hunks.push(currentHunk);
          }
          files.push(currentFile);
        }
        currentFile = null;
        currentHunk = null;
        oldFilePath = null;
        renameFromPath = null;
        continue;
      }

      // Rename detection: "rename from <path>" appears before --- / +++
      if (line.startsWith('rename from ')) {
        renameFromPath = line.slice('rename from '.length);
        continue;
      }

      if (
        line.startsWith('rename to ') ||
        line.startsWith('similarity index ')
      ) {
        continue;
      }

      // Old file path: --- a/file or --- /dev/null (for new files)
      if (line.startsWith('--- ')) {
        oldFilePath = line.slice(4);
        continue;
      }

      // New file path: +++ b/file or +++ /dev/null (for removed files)
      if (line.startsWith('+++ ')) {
        const newFilePath = line.slice(4);

        let fileDiffType: FileDiff['diffType'] = 'modified';
        let diffFilePath: string;
        let previousFilePath: string | undefined;

        const oldPath = oldFilePath ?? '';

        if (oldPath === '/dev/null') {
          fileDiffType = 'added';
          diffFilePath = newFilePath.startsWith('b/')
            ? newFilePath.slice(2)
            : newFilePath;
        } else if (newFilePath === '/dev/null') {
          fileDiffType = 'removed';
          diffFilePath = oldPath.startsWith('a/') ? oldPath.slice(2) : oldPath;
        } else if (renameFromPath) {
          fileDiffType = 'renamed';
          diffFilePath = newFilePath.startsWith('b/')
            ? newFilePath.slice(2)
            : newFilePath;
          previousFilePath = renameFromPath;
        } else {
          fileDiffType = 'modified';
          diffFilePath = newFilePath.startsWith('b/')
            ? newFilePath.slice(2)
            : newFilePath;
        }

        currentFile = {
          filePath: diffFilePath,
          diffType: fileDiffType,
          previousFilePath,
          hunks: [],
          addedLines: new Set(),
          removedLines: new Set(),
          modifiedLines: new Set(),
        };
        continue;
      }

      // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      if (line.startsWith('@@')) {
        const hunkMatch = line.match(
          /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/,
        );
        if (hunkMatch && currentFile) {
          if (currentHunk) {
            currentFile.hunks.push(currentHunk);
          }

          const oldStart = parseInt(hunkMatch[1], 10);
          const oldCount = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1;
          const newStart = parseInt(hunkMatch[3], 10);
          const newCount = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1;

          currentHunk = {
            oldStart,
            oldCount,
            newStart,
            newCount,
            lines: [],
            contextLineCount: 0,
          };
        }
        continue;
      }

      // Diff content lines
      if (currentHunk && currentFile && line.length > 0) {
        const firstChar = line[0];
        const content = line.slice(1); // Remove the +/- prefix

        if (firstChar === '+') {
          // For added lines, use new file line numbers
          const lineNumber = this.calculateLineNumber(currentHunk, 'added');

          currentHunk.lines.push({
            number: lineNumber,
            type: 'added',
            content,
          });
        } else if (firstChar === '-') {
          // For removed lines, use old file line numbers
          const lineNumber = this.calculateLineNumber(currentHunk, 'removed');

          currentHunk.lines.push({
            number: lineNumber,
            type: 'removed',
            content,
          });
        } else if (firstChar === ' ') {
          // Context line - count it so calculateLineNumber accounts for position advancement
          currentHunk.contextLineCount++;
          continue;
        } else if (firstChar === '\\') {
          // "No newline at end of file" marker - skip it (metadata, not content)
          continue;
        } else {
          throw new Error(
            `Unknown line type! First character of line is ${firstChar}`,
          );
        }
      }
    }

    // Add the last file and hunk
    if (currentHunk && currentFile) {
      currentFile.hunks.push(currentHunk);
    }
    if (currentFile) {
      files.push(currentFile);
    }

    // Calculate modified, added, and removed lines
    for (const file of files) {
      for (const hunk of file.hunks) {
        // Collect all removed and added lines from this hunk
        const removedLines = hunk.lines.filter(line => line.type === 'removed');
        const addedLines = hunk.lines.filter(line => line.type === 'added');

        const removedCount = removedLines.length;
        const addedCount = addedLines.length;
        const modifiedCount = Math.min(removedCount, addedCount);

        // Mark modified lines (use added line numbers for the new file)
        for (let j = 0; j < modifiedCount; j++) {
          const addedLine = addedLines.at(j);
          if (addedLine) {
            file.modifiedLines.add(addedLine.number);
          }
        }

        // Handle net additions
        for (let j = modifiedCount; j < addedCount; j++) {
          const addedLine = addedLines.at(j);
          if (addedLine) {
            file.addedLines.add(addedLine.number);
          }
        }

        // Handle net removals
        for (let j = modifiedCount; j < removedCount; j++) {
          const removedLine = removedLines.at(j);
          if (removedLine) {
            file.removedLines.add(removedLine.number);
          }
        }
      }
    }

    return {
      files,
      hasChanges: files.length > 0,
    };
  }

  /**
   * Calculate the line number for a diff line based on the hunk and line type.
   */
  private static calculateLineNumber(
    hunk: DiffHunk,
    lineType: 'added' | 'removed',
  ): number {
    const addedCount = hunk.lines.filter(l => l.type === 'added').length;
    const removedCount = hunk.lines.filter(l => l.type === 'removed').length;

    switch (lineType) {
      case 'added':
        return hunk.newStart + hunk.contextLineCount + addedCount;
      case 'removed':
        return hunk.oldStart + hunk.contextLineCount + removedCount;
      default:
        throw new Error(`Unknown line type: ${String(lineType)}`);
    }
  }

  /**
   * Get the content of a file at a specific git reference.
   */
  static show(ref: string, filePath: string): string {
    try {
      return execSync(`git show ${ref}:${filePath}`);
    } catch (error) {
      throw new Error(
        `Failed to get file content from git: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Resolve the commit hash to diff a PR branch against.
   *
   * In CI the base branch is provided via GITHUB_BASE_REF (falls back to `master`); the remote
   * branch tip is used directly to avoid shallow-clone merge-base issues. Locally we compute the
   * merge base between the base branch and HEAD, mirroring scripts/lintChanged.sh.
   */
  static async getMainBranchCommitHash(remote?: string): Promise<string> {
    const baseRefName = GITHUB_BASE_REF ?? 'master';

    // Fetch the base branch from the specified remote (or locally) to ensure it's available
    if (IS_CI || remote) {
      await exec(
        `git fetch ${remote ?? 'origin'} ${baseRefName} --no-tags --depth=1`,
      );
    }

    // In CI, use a simpler approach - just use the remote base branch directly.
    // This avoids issues with shallow clones and merge-base calculations.
    if (IS_CI) {
      const mainBaseRef = remote
        ? `${remote}/${baseRefName}`
        : `origin/${baseRefName}`;

      try {
        const {stdout: revParseOutput} = await exec(
          `git rev-parse ${mainBaseRef}`,
        );
        const mergeBaseHash = revParseOutput.trim();

        // Validate the output is a proper SHA hash
        if (!mergeBaseHash || !/^[a-fA-F0-9]{40}$/.test(mergeBaseHash)) {
          throw new Error(
            `git rev-parse returned unexpected output: ${mergeBaseHash}`,
          );
        }

        return mergeBaseHash;
      } catch (error) {
        logError(`Failed to get commit hash for ${mainBaseRef}:`, error);
        throw new Error(`Could not get commit hash for ${mainBaseRef}`);
      }
    }

    const mainBaseRef = remote ? `${remote}/${baseRefName}` : baseRefName;

    // For local development, try to find the actual merge base
    let mergeBaseHash: string;
    try {
      const {stdout: mergeBaseOutput} = await exec(
        `git merge-base ${mainBaseRef} HEAD`,
      );
      mergeBaseHash = mergeBaseOutput.trim();
    } catch {
      logWarn(
        `Warning: Could not find merge base between ${mainBaseRef} and HEAD.`,
      );

      // If merge-base fails locally, fall back to using the remote base branch
      try {
        const {stdout: revParseOutput} = await exec(
          `git rev-parse ${mainBaseRef}`,
        );
        mergeBaseHash = revParseOutput.trim();
      } catch (fallbackError) {
        logError(
          `Failed to find merge base with ${mainBaseRef}:`,
          fallbackError,
        );
        throw new Error(`Could not determine merge base with ${mainBaseRef}`);
      }
    }

    // Validate the output is a proper SHA hash
    if (!mergeBaseHash || !/^[a-fA-F0-9]{40}$/.test(mergeBaseHash)) {
      throw new Error(
        `git merge-base returned unexpected output: ${mergeBaseHash}`,
      );
    }

    return mergeBaseHash;
  }

  /**
   * Get changed files with their status (added, modified, removed, renamed) using git diff
   * against the provided base ref.
   */
  static getChangedFilesWithStatus(
    fromRef: string,
    toRef?: string,
  ): Promise<ChangedFile[]> {
    const diffResult = this.diff(fromRef, toRef);
    return Promise.resolve(
      diffResult.files.map(file => ({
        filename: file.filePath,
        status: file.diffType,
        previousFilename: file.previousFilePath,
      })),
    );
  }
}

export default Git;
export type {DiffResult, FileDiff, DiffHunk, DiffLine, ChangedFile};
