---
paths:
  - "pb_hooks/group.pb.js"
  - "pb_hooks/account.pb.js"
  - "pb_hooks/services/account.js"
---

# Cascade deletes vs. the group-deletion fixup

Relation `cascadeDelete: true` enforces deletion at the **SQLite foreign-key level** (deleting a
user deletes their groups → members → invites). Because that is DB-level, hooks do **not** fire for
cascaded rows.

The one place application logic must run on delete is **group deletion** (`onRecordDelete` in
`group.pb.js`): when a group is deleted, any item whose *only* sharing was that group would silently
become public — so the hook flips those items to `trusteesOnly = true`, and rolls the delete back if
the flip fails. A raw DB-level cascade (e.g. deleting the owner) bypasses this hook — keep that in
mind before adding user-deletion features.

The second delete hook is **member removal / leaving** (`onRecordDelete` on `group_members` in
`group.pb.js`): when a membership is deleted explicitly (owner removes a member, or a member
leaves), that member's items are un-shared from the group — otherwise they stay visible to the
group but break on request (the owner is no longer a member) and the ex-member can't reach the
group to un-share them. Same fail-safe + `trusteesOnly` flip as the group-delete fixup. It fires
**only for explicit membership deletes**: group/user cascade deletes are DB-level and don't trigger
hooks, so the whole-group teardown stays owned by the group-delete fixup.

Note the same DB-level caveat for **`trusts` edges on account deletion**: the `trusts` relations
`cascadeDelete`, but self-service deletion is *anonymize-in-place* (the `users` row is kept with
`deleted=true`), so the cascade never fires. `anonymizeAccount` (`services/account.js`) therefore
deletes the account's trust edges explicitly, in both directions
(`deleteByFilter('trusts', 'truster = {:u} || trustee = {:u}')`).
