# Git tools

Eight tools in `src/tools/git.ts` give the agent structured git access. They run
`git` through `spawn()` with arguments passed as an array, so nothing reaches a
shell and branch names or messages cannot inject commands.

All eight export from the `GIT_TOOLS` array and register in `ALL_TOOLS`
(`src/tools/index.ts`).

## Summary

| Tool | Prompts? | Purpose | Key parameters |
|------|----------|---------|----------------|
| `GitStatus` | no | Current status | `porcelain` |
| `GitLog` | no | Commit history | `limit`, `oneline`, `author`, `file` |
| `GitDiff` | no | Compare changes | `unstaged`, `commit1`, `commit2`, `file`, `stat` |
| `GitAdd` | yes | Stage changes | `paths` (required), `all` |
| `GitCommit` | yes | Create a commit | `message` (required), `amend` |
| `GitBranch` | yes | List, create, delete branches | `action`, `name`, `all` |
| `GitCheckout` | yes | Switch branches, restore files | `branch`, `createNew`, `file` |
| `GitReset` | yes | Unstage or reset | `target`, `mode`, `file` |

`GitStatus`, `GitLog`, and `GitDiff` are marked `readOnly`, which is what lets
the agent loop run them without a permission prompt. The rest go through the
gate. `GitBranch` is not marked read-only even though listing is harmless: the
same tool deletes branches, and the flag is per-tool rather than per-call.

## Reference

### GitStatus

Reports the current branch, staged files, unstaged changes, and untracked files.

- `porcelain` (boolean, default `false`): machine-readable output for parsing.

### GitLog

- `limit` (number, default `10`): maximum commits to show.
- `oneline` (boolean, default `true`): compact format.
- `author` (string): filter by author name.
- `file` (string): restrict history to one path.

```json
{ "limit": 20 }
{ "author": "John", "limit": 5 }
{ "file": "src/main.ts", "limit": 10 }
```

### GitDiff

With no arguments, shows staged changes.

- `unstaged` (boolean, default `false`): show working-directory changes instead.
- `commit1`, `commit2` (string): compare two commits or branches.
- `file` (string): restrict the diff to one path.
- `stat` (boolean): insertion and deletion counts only.

```json
{ "unstaged": true }
{ "commit1": "main", "commit2": "HEAD" }
{ "commit1": "HEAD~1" }
{ "file": "src/main.ts", "stat": true }
```

### GitAdd

- `paths` (string array, required): files or directories to stage.
- `all` (boolean, default `false`): include deletions.

```json
{ "paths": ["src/main.ts"] }
{ "paths": ["src/", "README.md"] }
{ "paths": [], "all": true }
```

### GitCommit

Commits what is already staged, so it normally follows `GitAdd`.

- `message` (string, required): rejected if empty.
- `amend` (boolean, default `false`): replace the previous commit.

```json
{ "message": "Add new feature" }
{ "message": "Fix typo", "amend": true }
```

Amending rewrites the last commit. On a branch that has been pushed, that means
the remote and local histories diverge until someone force-pushes.

### GitBranch

- `action` (string, default `"list"`): `list`, `create`, or `delete`.
- `name` (string): required for `create` and `delete`.
- `all` (boolean): include remote branches when listing.

```json
{ "all": true }
{ "action": "create", "name": "feature/new-thing" }
{ "action": "delete", "name": "old-branch" }
```

### GitCheckout

- `branch` (string): branch to switch to.
- `createNew` (boolean): create the branch first.
- `file` (string): restore one file from HEAD.

```json
{ "branch": "main" }
{ "branch": "feature-x", "createNew": true }
{ "file": "src/main.ts" }
```

Restoring a file discards uncommitted changes to it with no recovery path.

### GitReset

- `target` (string, default `"HEAD"`): commit or branch to reset to.
- `mode` (string, default `"mixed"`): `soft`, `mixed`, or `hard`.
- `file` (string): unstage a single file.

Modes:

- `soft`: move HEAD, leave changes staged.
- `mixed`: unstage changes, leave files modified.
- `hard`: discard changes and match the target commit.

```json
{ "file": "src/main.ts" }
{ "target": "HEAD~1", "mode": "mixed" }
{ "target": "main", "mode": "hard" }
```

`hard` throws away uncommitted work permanently.

## Workflows

Review and commit:

```
GitStatus -> GitDiff {unstaged: true} -> GitAdd {paths} -> GitCommit {message} -> GitLog {limit: 5}
```

Correct the last commit:

```
GitAdd {paths} -> GitCommit {message, amend: true}
```

Start a feature branch:

```
GitBranch {action: "create", name} -> GitCheckout {branch} -> GitAdd -> GitCommit
```

Compare two branches:

```
GitDiff {commit1: "main", commit2: "feature-x", stat: true}
```

## Limits

- Every command is killed after 30 seconds.
- Output over 50,000 characters is truncated, so a huge diff cannot flood the
  context window. Narrow it with `file` or `stat` instead.
- Anything outside these eight tools (merge, rebase, stash, tags, remotes, push,
  pull, blame) still needs the `Bash` tool.
