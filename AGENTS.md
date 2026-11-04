# Repository agent instructions

## GitHub publishing from ChatGPT Work

ChatGPT Work's connected GitHub tools and its command-line Git can have separate authentication. Do not assume a successful clone, repository read, or local commit proves that shell pushes are authenticated.

For this repository, the connected GitHub account and a branch-update request were verified on November 3, 2026. The Work shell had no configured Git credential helper. Treat these as observed conditions, not a guarantee about later sessions.

1. At the start of repository work, inspect the connected account, repository access, and current target branch head. Confirm that the required publishing tools are available before relying on them.
2. Prefer the authenticated GitHub tools for publishing from Work. Local Git can still be used for diffs, commits, and tests. Use shell pushes only when that shell's authentication has been verified.
3. If shell Git reports `could not read Username`, stop retrying that path and use the connected GitHub publishing tools. Do not make the user re-clone or reconnect a working integration to remedy missing shell credentials. Do not ask for tokens or passwords in chat.
4. Publish only the intended changes on the user's target branch. Preserve unrelated files and existing history. For a multi-file change, use the available Git data tools to create one commit based on the current remote tree, then update the branch with the observed head as `expected_sha` and `force=false`. Re-read and reconcile if the branch moves.
5. When recovering local commits, preserve their history and identity where supported. If publishing equivalent contents creates a different commit SHA, say so explicitly; do not claim the original commit was pushed.
6. After publishing, independently read the target branch head and changed files from GitHub. Report the verified commit URL and distinguish a local commit, a saved backup, and a published GitHub commit.
7. If the connected route fails too, preserve the completed work and report that route's exact error. A missing shell login alone does not establish that all GitHub publishing is unavailable.

These instructions do not create credentials or guarantee future service availability. They establish the publishing route and verification required for this repository.
