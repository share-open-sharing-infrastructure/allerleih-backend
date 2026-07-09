---
name: write-tests
description: Write integration tests for the AllerLeih PocketBase backend, following this repo's conventions (tests/<area>.test.mjs, Node's node:test runner, a real throwaway PocketBase spun up by tests/harness.mjs). Use whenever the user asks to write, add, or improve tests, increase coverage, or verify a migration, collection access rule, or pb_hook end-to-end — even if they don't say "integration test". Reach for it before merging any change to migrations, collection rules, or hooks, since those can only be verified against a running instance.
---

# write-tests (backend)

The backend has no unit-testable layer: migrations, collection access rules, and `pb_hooks`
all run *inside* PocketBase. So we test them end-to-end against a **real, throwaway** PocketBase
that the harness boots fresh for each run — it applies `pb_migrations/` from scratch and loads
`pb_hooks/`, so a test failure means the actual deployed behaviour is wrong, not a mock.

Before writing, skim a nearby suite to copy the local style: `tests/conversations.test.mjs` and
`tests/visibility.test.mjs` (access-rule visibility), `tests/harness.mjs` (the helpers), and the
README "Testing" section (what's already covered).

## 1. Where the file goes

One file per feature area: `tests/<area>.test.mjs` (e.g. `tests/groups.test.mjs`). The npm script
globs `tests/*.test.mjs`, so a new file is picked up automatically — no registration.

## 2. The harness gives you everything

Import only from `./harness.mjs`; never start PocketBase yourself.

| Helper | Purpose |
|---|---|
| `startPB()` | wipe `pb_test_data/`, boot a fresh instance on **:8091**, auth as superuser. Returns the process. |
| `stopPB(proc)` | kill the instance and remove the throwaway dir. |
| `makeUser(name)` | create a verified user (as superuser) and log in → `{ id, username, t }` where `t` is the auth token. |
| `api(method, path, token, body)` | `fetch` wrapper → `{ status, json }`. Omit `token` for an anonymous request. |
| `adminAuth()` | the superuser token — use it in setup to bypass collection rules (e.g. delete a user to exercise a cascade). |
| `BASE` | the instance URL, if you need to build a request by hand. |

## 3. Test skeleton

Use Node's built-in runner (`node:test`) and `assert/strict` — no test framework dependency. Boot
one instance per file in `before`, tear it down in `after`:

```js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api } from './harness.mjs'

let pb, owner, member, outsider

before(async () => {
  pb = await startPB()
  owner = await makeUser('owner')      // usernames must be >= 3 chars
  member = await makeUser('member')
  outsider = await makeUser('outsider')
})
after(() => stopPB(pb))

test('a group member can request a group item, a non-member cannot', async () => {
  const g = await api('POST', '/api/collections/groups/records', owner.t, { name: 'G', owner: owner.id })
  const ok = await api('POST', '/api/collections/conversations/records', member.t, {
    requester: member.id, itemOwner: owner.id, requestedItem: itemId,
  })
  assert.equal(ok.status, 200, 'group member can start a conversation')

  const bad = await api('POST', '/api/collections/conversations/records', outsider.t, { /* … */ })
  assert.notEqual(bad.status, 200, 'non-member is blocked by the createRule')
})
```

## 4. What to assert

Drive the API exactly as a client would and assert on the **status code and JSON** that PocketBase's
rules/hooks produce. The interesting assertions here are about *access*: who can read/create/update a
record and who gets a `403`/`404`. Pass a message string to `assert` so a failure reads clearly
(`assert.equal(res.status, 200, 'owner can read own item')`).

- Test the rule from **both sides** — the allowed actor succeeds *and* the forbidden actor is denied.
  A rule that only ever sees the happy path isn't really tested.
- Cover the masking/visibility guarantees the views give (e.g. an item stays out of `items_searchable`
  for someone who only has conversation-scoped access) — see `tests/visibility.test.mjs`.
- For filters in a query string, escape them: `filter=${encodeURIComponent('group="..." && user="..."')}`.

## 5. Isolate data per test

Every test in a file shares the **same instance** (only wiped between files, not between tests). So
give records unique, test-local names/usernames instead of relying on a clean slate, and don't assume
ordering. Use `adminAuth()` only for setup/teardown that must bypass rules — the behaviour under test
should go through a real user's token.

## 6. Run it

```bash
npm test     # node --test --test-concurrency=1 tests/*.test.mjs
```

Concurrency is pinned to **1** on purpose: every file boots its own instance on the same port 8091,
so they must run one at a time. The run needs the `./pocketbase` binary in the repo root (it's
gitignored — download the matching version if it's missing) and uses port **8091**, separate from your
dev instance on 8090, so your dev data is never touched. To run a single suite while iterating:
`node --test tests/groups.test.mjs`.
