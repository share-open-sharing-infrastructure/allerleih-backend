---
name: refresh-skills
description: Audit and update this repo's own .claude/skills against the current codebase, fixing drifted file paths, helper signatures, hook/collection names, and command names so the skills don't rot. Use whenever the user asks to refresh, audit, update, or check the skills, after a change that touches code the skills reference (a changed test-harness helper, a renamed hook, a moved migration convention), or when a skill turns out to be inaccurate. Run it before relying on a skill you haven't used in a while.
---

# refresh-skills

Skills encode real file paths, helper signatures, hook/collection names and commands — and the code
moves underneath them. A stale skill is worse than none: it leads confidently to a test that won't
run or a migration that doesn't match the real schema. This skill treats the skills like code:
extract their checkable claims, verify each against the current repo, and fix what drifted — without
changing what a skill is *for*.

## 1. Scope

Operate on every `SKILL.md` under `.claude/skills/*/` in **this** repo. If a skill explicitly
references the sibling `share-mvp` frontend repo (checked out next to this one), verify those claims against it too;
otherwise leave other repos alone.

## 2. Extract the checkable claims

For each `SKILL.md`, pull out every statement that can rot — these are facts, not prose:

- **File/dir paths** (`tests/harness.mjs`, `pb_hooks/notification.pb.js`, `pb_migrations/`).
- **Helper signatures** from the test harness (`api(method, path, token, body)`, `makeUser(name)`,
  `startPB()`, `stopPB(proc)`, `adminAuth()`) and exported services.
- **Commands & scripts** (`npm test`, `./pocketbase serve …`, `--migrationsDir`/`--hooksDir`).
- **Collection / field / view names and access-rule claims** (`group_members`, `items_searchable`,
  the owner-admin hook, unique `(group, user)`).
- **Migration conventions** (timestamp-prefixed filenames, auto-discovery) and any **line hints**.

## 3. Verify each against the code

Use Grep/Glob/Read — don't trust memory:

- **Path** → confirm it exists (`Glob`); if moved, find the new location.
- **Helper signature** → grep the `export function`/`export async function` in `tests/harness.mjs`
  (or the service file) and Read it. Confirm arg names, order, count, and what it returns. This is the
  highest-value check — a wrong signature is the failure that bites hardest.
- **Command** → confirm the script in `package.json` (`npm test` = `node --test …`) and that any
  PocketBase flags the skill cites still exist (`./pocketbase serve --help`).
- **Collection/hook/rule claim** → confirm against the relevant `pb_migrations/*.js` or
  `pb_hooks/*.js`. For behaviour (e.g. "creating a group auto-inserts the owner as admin"), open the
  hook and confirm it still does that.
- **Embedded test/migration snippet** meant to run → reconcile it against the real helpers/schema;
  where cheap, sanity-check by actually running it against the throwaway instance (`npm test`).

## 4. Fix the drift — facts only

Edit each `SKILL.md` to match reality, **preserving the skill's wording, structure, and intent**:

- Correct the path / signature / command / name / line hint to the current truth.
- Keep the description's *meaning* and trigger boundary intact — fix a stale path inside it, but don't
  re-scope what the skill triggers on.
- A helper that was **renamed** → update it. **Removed with no replacement**, or a behaviour change
  you can't confidently map → **don't guess; flag it for the human** in your report rather than
  inventing an API.

## 5. Report

Output a compact drift table and the fixes you made:

```
skill          claim                              status     action
write-tests    api(method, path, token, body)     ok         —
write-tests    startPB() on port 8091             ok         —
new-migration  pb_migrations/ timestamp prefix    ok         —
```

Use four statuses: **ok** (matches reality), **DRIFTED** (wrong value that would mislead or break —
fix it), **IMPRECISE** (points at the right thing but mis-describes it — e.g. an inline union called a
named "type", or a paraphrased command/line-hint — fix the wording), **GONE** (API removed with no
replacement — flag for the human, don't invent one).

End with anything you flagged for human judgement (GONE items, ambiguous renames). If nothing
drifted, say so plainly — a clean audit is a valid result.

## When to run

After merging changes that touch code a skill references (the harness, a hook, a migration
convention), before leaning on a skill you haven't used recently, or periodically. This is the
operational half of the `CLAUDE.md` "keep in sync" rule: it keeps the skills aligned with the code.
