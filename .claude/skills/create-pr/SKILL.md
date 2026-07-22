---
name: create-pr
description: Open a pull request to main for the allerleih-backend repo. Runs the test preflight, drafts a title and body from the branch diff, and creates the PR with gh. Use when the user asks to open/create a PR, raise a pull request, or "ship" the current branch.
---

# create-pr

Open a clean, review-ready pull request from the current branch to `main`.

## 1. Preconditions

- Confirm the working tree's changes are committed. If there are uncommitted changes, show
  `git status` and ask whether to commit them first (don't commit silently).
- Get the current branch: `git branch --show-current`.
  - **If it is `main`:** stop. Offer to create a feature branch (suggest a name derived from
    the change, e.g. `fix/group-invite-expiry`) and move the commits there. Do not push to `main`.
- Never stage or commit `.env`, `pb_data/`, or the `pocketbase` binary.

## 2. Preflight (must pass before opening the PR)

```bash
npm test
```

`.github/workflows/ci.yml` only deploys on push to `main` — there is no PR-triggered test CI for
this repo, so this local run is the actual quality gate. Stop and surface failures rather than
opening a broken PR; fix them or ask the user how to proceed.

If the change touched `pb_migrations/`, also sanity-check it applies cleanly:
`./pocketbase serve --http=0.0.0.0:8090` against a throwaway `pb_data/` (or rely on `npm test`,
which already applies every migration against a fresh DB).

## 3. Draft the PR

- Summarize the branch vs base: `git log --oneline main..HEAD` and `git diff --stat main...HEAD`.
- Write a **title** (concise, imperative) and a **body** with:
  - **What** changed and **why** (the problem it solves / issue it implements).
  - **Test notes:** confirm `npm test` passed; call out any manual verification the reviewer
    should do (e.g. exercising a new endpoint, checking a migration's `down()`).
  - Linked issue if the branch name encodes one (e.g. `431-...` → `Closes #431`).
  - If this change pairs with a frontend PR in `share-mvp` (e.g. a schema change), cross-link
    both PR URLs in each body.

## 4. Create it

```bash
git push -u origin HEAD        # if the branch isn't pushed yet
gh pr create --base main --title "<title>" --body "<body>"
```

End the PR body with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## 5. After creating

- Print the PR URL.
- Note that merging to `main` triggers `.github/workflows/ci.yml`, which deploys the new
  PocketBase binary, `pb_hooks/`, and `pb_migrations/` straight to the Uberspace server and
  restarts the service — there is no staging step, so a merged migration applies live.
