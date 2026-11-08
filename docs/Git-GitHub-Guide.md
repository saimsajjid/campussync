# Git & GitHub Guide for the Team

A working agreement for **3 people, 7 days, one repo, and an AI coding agent that writes a lot of the code.** Short, strict, and built to prevent the three classic hackathon disasters: lost work, merge chaos, and leaked secrets.

---

## 1. The Rules in 12 Lines

1. `main` always works. If it's broken, fixing it is the top priority.
2. Never push straight to `main`. Work on a branch, merge through a pull request (PR).
3. One branch = one small task. Merge it within a day.
4. Commit often (every 30 to 60 minutes of real progress).
5. One commit = one logical change, with a message in the format below.
6. **Commit before every antigravity run** (a checkpoint). Always.
7. Never run `git add .` without reading `git status` and `git diff` first.
8. Never commit secrets (`.env`, keys, passwords, tokens). Ever.
9. Pull before you start working and before you open a PR.
10. Keep PRs small (under about 400 changed lines) and review within 30 minutes.
11. Don't rewrite history on shared branches (`push --force` on `main` is forbidden).
12. Friday evening is **code freeze**. After that only bug fixes through PRs. Saturday morning is tag and submit.

---

## 2. One-Time Setup (everyone)

```bash
git config --global user.name  "Your Name"
git config --global user.email "your-github-email@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase false
git config --global core.autocrlf input      # Mac/Linux
# Windows users:  git config --global core.autocrlf true
```

- Use a **GitHub-private noreply email** if you don't want your real email in public commits (GitHub Settings, Emails, "Keep my email addresses private").
- Authenticate with an **SSH key** or a **personal access token**. Never paste tokens into chat, code, or the repo.
- Install the GitHub CLI (`gh`) if you like: `gh pr create`, `gh pr merge` are fast.

---

## 3. Repository Setup (done once, by Saim)

### 3.1 Create the repo
- Name: short and lowercase, e.g. `campussync` (rename later if the product name changes; GitHub redirects).
- **Public** from the start (the submission needs a public repo). Because it's public from day one, **secret hygiene matters from the first commit.**
- Add: README, `.gitignore` (Node), MIT license (or none, your choice).

### 3.2 Folder layout
```
repo/
├── shared/         # schemas, types, permission map
├── server/         # API, migrations, seed, integrity checks
├── web/            # frontend app, sync engine, local store
├── scripts/        # reset-demo, backup, chaos test, deploy helpers
├── docs/           # Requirements, Architecture, Design-Spec, demo script, test checklist
├── .github/        # workflows, PR template
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

### 3.3 `.gitignore` (must exist before the first real commit)
```
node_modules/
dist/
build/
coverage/
.env
.env.*
!.env.example
*.pem
*.key
*.log
.DS_Store
.vscode/
.idea/
pgdata/
*.sqlite
tmp/
```

### 3.4 `.env.example`
Commit this file with **names and fake/safe sample values only**:
```
DATABASE_URL=postgres://campussync:change-me@db:5432/campussync
JWT_SECRET=change-me-to-a-long-random-string
DEMO_MODE=true
PORT=3050
```
The real `.env` is never committed. A judge copies `.env.example` to `.env` and it just works for local demo.

### 3.5 Protect `main` (GitHub: Settings, Branches, Add rule)
- Require a pull request before merging.
- Require status checks to pass (once CI exists).
- Block force pushes and deletion.
- With 3 people, **do not require 2 approvals**. One approval or self-merge after CI is green is fine. Speed matters.

### 3.6 Invite teammates
Settings, Collaborators, add Ameen and Asad with **Write** access.

### 3.7 PR template (`.github/pull_request_template.md`)
```
## What changed
(1 to 3 lines)

## Why
(Which requirement or task: e.g. FR-5.5, "idempotency")

## How to test
(Steps or the test command)

## Checklist
- [ ] Runs locally
- [ ] Tests pass
- [ ] No secrets or junk files
- [ ] Docs updated if behavior changed
```

---

## 4. Branching

### 4.1 Model: `main` plus short-lived branches
No `develop` branch, no long-running branches. Too much overhead for a week.

```
main  ─●────●────●────●────●──►   (always working)
        \  /      \  /
         ●─●       ●─●           (feature branches, merged within a day)
```

### 4.2 Branch names
`type/short-description` in lowercase with hyphens.

| Type | Use | Example |
|---|---|---|
| `feat/` | New capability | `feat/apply-edit-transaction` |
| `fix/` | Bug fix | `fix/duplicate-op-replay` |
| `test/` | Tests only | `test/behavior-matrix-rows-4-9` |
| `docs/` | Documentation | `docs/run-guide` |
| `chore/` | Setup, deps, config | `chore/docker-compose-local` |
| `refactor/` | Restructure without behavior change | `refactor/sync-engine-modules` |
| `ci/` | Pipelines | `ci/arm64-image-build` |

### 4.3 When to make a branch
- **Always** for any task that takes more than a few minutes or touches more than one file.
- Always **before** asking antigravity to do a task, so a bad generation never touches `main`.
- A one-line typo fix in docs can go through a tiny branch and PR too. It takes 30 seconds, and the habit prevents mistakes.

### 4.4 Starting work
```bash
git switch main
git pull
git switch -c feat/outbox-sync-engine
```

### 4.5 Who works where (to avoid conflicts)

| Area | Primary owner |
|---|---|
| `server/`, `shared/`, `web/src/sync/`, `scripts/` | Saim |
| `web/src/pages/`, `web/src/components/`, styles | Ameen |
| `docs/`, test checklist, demo script, README polish | Asad |

- If you must touch someone else's area, **tell them first** in the group chat.
- **Shared hot spots** (conflicts likely): `package.json`, lockfile, `shared/` schemas, `docker-compose.yml`, `README.md`. Change these in small, quick PRs and say so in the chat.

---

## 5. Commits

### 5.1 Message format (Conventional Commits)
```
type(scope): short summary in imperative mood

Optional body: what and why (not how). Wrap at about 72 characters.

Refs: FR-5.5
```

**Rules**
- **Summary under 72 characters**, imperative ("add", "fix", "remove"), no period, lowercase after the colon.
- **Type** is one of: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `style`, `perf`, `ci`, `revert`.
- **Scope** is the area: `server`, `web`, `shared`, `sync`, `db`, `ui`, `auth`, `docs`, `ci`, `demo`, `scripts`.
- Use the **body** when the why isn't obvious.
- Reference the requirement ID in the footer when relevant (`Refs: FR-7.3`).
- Breaking change: add `!` (e.g. `feat(db)!: rename field_versions column`) and explain in the body.

### 5.2 Good vs bad messages

| Good | Bad |
|---|---|
| `feat(server): add apply-edit transaction with opId check` | `update` |
| `fix(sync): stop retrying permanently rejected ops` | `fixed bug` |
| `test(server): cover lost-response replay (matrix row 4)` | `tests` |
| `chore(db): add migration for processed_ops table` | `changes` |
| `docs: add run guide to README` | `readme` |
| `refactor(web): move outbox logic out of components` | `cleanup stuff` |
| `feat(ui): add per-field sync status badge` | `ui done!!` |
| `fix(auth): reject student edits to official fields` | `wip` |

### 5.3 Example with a body
```
fix(server): replay stored result for duplicate opId

Previously a retried op was re-applied and created a second history
row. Now the transaction checks processed_ops first and returns the
stored result without touching the record.

Refs: FR-5.5, matrix row 4
```

### 5.4 What belongs in one commit
- **One logical change.** If you can't summarize it in one line without "and", split it.
- It **builds and passes tests** whenever practical.
- Include related test and doc changes **with** the code they cover.
- Don't mix **formatting-only** changes with logic changes. Commit formatting separately (`style:`).
- Don't mix a **dependency upgrade** with a feature.

### 5.5 When to commit
- A function works and has a test: commit.
- A migration is added and applied cleanly: commit.
- Before you try something risky: commit (checkpoint).
- Before you start a large antigravity task: commit (checkpoint).
- Before you switch tasks or go to sleep: commit and push.
- **Not** while the code is half-broken, unless on your own branch and clearly marked `wip:` (squash it away at merge).

### 5.6 Checkpoint commits on your own branch
Messy history on your feature branch is fine (`wip: trying cursor pull`). The PR is **squash-merged**, so `main` only gets one clean conventional commit per PR.

### 5.7 Always inspect before you commit
```bash
git status                 # what changed?
git diff                   # exactly what lines?
git add path/to/file       # add specific files, not everything
git diff --staged          # what's about to be committed?
git commit -m "feat(server): add conflict storage"
```
**Never** run `git add .` or `git commit -a` blindly. Agents leave junk: stray files, debug logs, generated folders, `.env` copies.

### 5.8 What must NEVER be committed
| Category | Examples |
|---|---|
| Secrets | `.env`, API keys, DB passwords, JWT secrets, SSH keys, `*.pem`, tokens |
| Generated output | `node_modules/`, `dist/`, `build/`, coverage reports |
| Local data | Database dumps with real data, `pgdata/`, local SQLite files |
| Editor and OS junk | `.DS_Store`, `.idea/`, personal editor settings |
| Large binaries | Raw screen recordings (host the video on YouTube/Drive), huge images |
| Server details | Anything revealing private infrastructure beyond what the README needs |

### 5.9 What SHOULD be committed
- Source code, migrations, seed scripts
- `.env.example`, `docker-compose.yml`, `Dockerfile`
- Lockfile (`package-lock.json` or equivalent)
- Tests and test fixtures
- Docs: requirements, architecture, design spec, demo script, test checklist
- README screenshots or a small GIF (compressed)

---

## 6. Pull Requests

### 6.1 Flow
```bash
git push -u origin feat/outbox-sync-engine
gh pr create --fill          # or use the GitHub website
```
1. Open the PR early. Add `[WIP]` in the title if it isn't ready.
2. Fill in the template (what, why, how to test).
3. Wait for CI (when it exists) and a quick review.
4. **Squash and merge.** Use a conventional commit as the title.
5. Delete the branch.
6. Everyone: `git switch main && git pull`.

### 6.2 PR title = the commit that lands on `main`
`feat(sync): add outbox with ordered delivery and backoff`

### 6.3 Reviewing (be fast and useful)
- Review within **30 minutes** during the sprint; unreviewed PRs block everyone.
- Check: does it run, does it match the requirement, any secrets or junk files, any obvious logic holes.
- For the **sync core and apply-edit transaction**, Saim reviews everything, even Ameen's or antigravity's changes. That code is the project.
- Comment on what's wrong and why, not on style preferences. No bike-shedding this week.

### 6.4 Size and time limits
- Under about **400 changed lines** per PR where possible.
- If a PR sits **over 2 hours** unreviewed, ping the group.

---

## 7. Working with Antigravity (AI agent) Safely

| Step | Action |
|---|---|
| 1 | `git switch -c feat/<task>` from an up-to-date `main` |
| 2 | **Commit any uncommitted work** (checkpoint) |
| 3 | Give the agent **one small task** with a clear done-check |
| 4 | When it finishes: `git status`, `git diff`: **read it** |
| 5 | Run the tests and the app |
| 6 | If it's wrong: `git restore .` (discard changes) or `git reset --hard HEAD` (back to the checkpoint) |
| 7 | If it's good: stage specific files, commit with a proper message |
| 8 | Remove anything unrequested (extra files, new dependencies, renamed things) |
| 9 | Push and open a PR |

**Watch for:**
- New dependencies you didn't ask for (check `package.json` changes).
- Changes to files outside the task's area.
- Edits to migrations that were already applied (create a **new** migration instead, never edit an old one once merged).
- Deleted tests, or tests weakened to make them pass.
- Hard-coded secrets, URLs, or IPs.
- Large reformatting that hides real changes.

---

## 8. Daily Rhythm

| When | Do |
|---|---|
| **Morning** | `git switch main && git pull`. Post in chat what you're working on today and which branch. |
| **Before each task** | New branch from fresh `main`. |
| **During** | Commit every 30 to 60 minutes. Push at least every couple of hours. |
| **Before opening a PR** | `git pull origin main` into your branch (or rebase), resolve conflicts, run tests. |
| **Evening** | Push everything. Merge what's ready. Post a 2-line summary (done, next, blocked). |

**Push often**: unpushed work on a laptop is work that doesn't exist if the laptop dies.

---

## 9. Merge Conflicts

### 9.1 Prevent them
- Small branches, merged quickly.
- Pull `main` into your branch daily.
- Respect the ownership areas (section 4.5).
- Announce changes to hot-spot files.

### 9.2 Resolve them
```bash
git switch my-branch
git pull origin main          # triggers the conflict
# open the conflicted files; look for <<<<<<<, =======, >>>>>>>
# edit to keep the correct final content, remove the markers
git add <resolved-file>
git commit                    # completes the merge
```
- **Read both sides.** Don't just pick "mine" blindly.
- After resolving, **run the tests**.
- If unsure, ask the other person; don't guess on sync or schema code.

### 9.3 Lockfile conflicts
Don't hand-edit them. Take `main`'s version, then reinstall:
```bash
git checkout origin/main -- package-lock.json
npm install
git add package-lock.json
```

### 9.4 Migration conflicts
Two people adding migrations with the same number: **rename yours** to the next free number and re-test from a fresh database.

---

## 10. Undo Cheat Sheet

| Situation | Command |
|---|---|
| Discard uncommitted changes in one file | `git restore path/to/file` |
| Discard all uncommitted changes | `git restore .` |
| Unstage a file (keep changes) | `git restore --staged path/to/file` |
| Fix the last commit message (not yet pushed) | `git commit --amend -m "new message"` |
| Add a forgotten file to the last commit (not pushed) | `git add file && git commit --amend --no-edit` |
| Undo the last commit, keep the changes | `git reset --soft HEAD~1` |
| Undo the last commit, discard the changes | `git reset --hard HEAD~1` (careful) |
| Undo a commit that is **already pushed/merged** | `git revert <commit-sha>` (creates a new undo commit) |
| Go back to a checkpoint | `git reset --hard <sha>` (careful, loses newer uncommitted work) |
| Find a "lost" commit | `git reflog` |
| Save unfinished work temporarily | `git stash` then later `git stash pop` |
| See what changed in a commit | `git show <sha>` |
| Compare your branch to main | `git diff main...HEAD` |
| See history briefly | `git log --oneline --graph --decorate -20` |

**Golden rule:** anything **already pushed to a shared branch** is undone with `revert`, not `reset`.

---

## 11. If a Secret Leaks (public repo, so this is urgent)

1. **Rotate the secret immediately** (change the password, regenerate the key or token). Do this **first**. Deleting it from Git is not enough because bots scrape public repos within minutes.
2. Remove it from the code and commit the fix.
3. If it's in history, rewrite it out (`git filter-repo` or BFG), force-push, and tell the team to re-clone. Since you've already rotated, this is cleanup, not protection.
4. Add the file or pattern to `.gitignore`.
5. Check GitHub's **Security** tab for secret-scanning alerts.

**Prevention:** check `git status` before every commit, keep `.env` in `.gitignore` from the very first commit, and optionally add a secret scanner (such as `gitleaks`) as a pre-commit hook or CI step.

---

## 12. Tags and Releases

| Tag | When |
|---|---|
| `v0.1-thin-slice` | First end-to-end edit, sync, conflict, history working |
| `v0.5-core-complete` | All Must requirements working |
| `v0.9-demo-ready` | Simulator, integrity checker, reset, local run all working |
| `v1.0-submission` | The exact commit you submit |

```bash
git tag -a v0.1-thin-slice -m "First working end-to-end slice"
git push origin v0.1-thin-slice
```
Tags are **safe rollback points** if something goes wrong late in the week. Create a GitHub **Release** for `v1.0-submission` with a short description.

---

## 13. CI (GitHub Actions): Minimum Useful Set

Keep it small. Two workflows:

1. **Test workflow** (on every PR): install dependencies, run lint (if configured), run tests. Blocks merging if red.
2. **Image build workflow** (on merge to `main` or a tag): build the **arm64** Docker image and push it to GHCR for the Oracle server.

Don't spend more than an hour on CI. A red CI nobody trusts is worse than none.

---

## 14. Issues and Task Tracking

- Use **GitHub Issues** plus a **Project board** (Todo, Doing, Review, Done). Three people don't need Jira.
- One issue per task, titled like a commit: `Add apply-edit transaction`.
- Link each issue to its requirement ID.
- Reference issues in PRs (`Closes #12`).
- Label: `must`, `should`, `could`, `bug`, `blocked`.
- Asad can maintain the board and the bug list from his test runs.

---

## 15. Repository Hygiene for Judges

Judges open your repo, so it is part of the presentation score.

- **README** at the top: what it is, the problem, a screenshot or GIF, features, tech stack, run guide, demo accounts, scaling and limits, links to `/docs`.
- **`/docs`** holds Requirements, Architecture, Design-Spec, demo script, test checklist.
- **Clean `main` history** thanks to squash merges.
- **No junk**: no leftover `test.js`, `temp/`, commented-out blocks, or `console.log` spam.
- **No secrets** (re-check before the final tag).
- **Run guide works** on a fresh clone. Test it.
- Add a short `CONTRIBUTING` note only if time allows; it isn't needed.

---

## 16. Pre-Submission Checklist (Saturday morning)

- [ ] On a **fresh clone in a new folder**, `docker compose up` works with zero manual steps
- [ ] Run guide matches reality exactly (commands, ports, demo logins)
- [ ] No `.env`, keys, or tokens anywhere in the repo or history
- [ ] `.env.example` present and complete
- [ ] README has screenshots, features, problem statement, limits
- [ ] All docs present in `/docs`
- [ ] `main` is green (tests pass)
- [ ] `v1.0-submission` tag pushed on the final commit
- [ ] Repo visibility is **Public**; open it in a private/incognito window to confirm
- [ ] Demo video link opens in a private window (public, not "unlisted needs login")
- [ ] Team name selected correctly on the submission form
- [ ] Submit **early**, not in the last hour

---

## 17. Quick Command Reference

```bash
# Start a task
git switch main && git pull
git switch -c feat/my-task

# Work loop
git status
git diff
git add path/to/file
git diff --staged
git commit -m "feat(scope): summary"

# Share
git push -u origin feat/my-task
gh pr create --fill

# Stay current
git pull origin main

# After merge
git switch main && git pull
git branch -d feat/my-task

# Safety
git stash            # park unfinished work
git stash pop        # bring it back
git reflog           # find lost commits
```
