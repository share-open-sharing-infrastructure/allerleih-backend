---
paths:
  - "pb_hooks/retention.pb.js"
  - "pb_hooks/jobs/retention.js"
---

# Scheduled jobs (`retention.pb.js` + `jobs/retention.js`)

GDPR data-retention (#461, DSE v2.8): five nightly `cronAdd` jobs — inactive accounts (02:00,
anonymize via `anonymizeAccount`; accounts with an open loan are skipped and user + admin get a
mail), conversations incl. messages + related notifications (02:10), notifications (02:20),
feedback (02:30), and the inactivity **warning** (02:40 — emails accounts
`RETENTION_INACTIVE_WARN_DAYS` before the deletion threshold, stating the deletion date; runs
independently of the deletion job and never delays it). Windows come from `constants.js`
(`RETENTION_*`); a window of `0` disables the job, a NaN/negative value is refused (logged, never
runs) — as is a warn lead time that exceeds the inactive window (would select active users).
Per-record failures are isolated (one bad row can't abort the batch); jobs are idempotent and log
**counts only, never personal data**. `users.lastLoginAt` (the inactivity signal) is stamped in
`account.pb.js`'s `onRecordAuthRequest`, throttled to once per 24h. `users.lastLoginAt`,
`users.retentionNotifiedAt` and `users.deletionWarnedAt` are `hidden: true` — the `users`
collection is readable by any authenticated user, so these internal fields must never be
serialized. The open-loan skip notice is deduped via `retentionNotifiedAt` (cooldown); the warning
is sent once per inactivity cycle via `deletionWarnedAt` (a stamp older than the effective last
activity belongs to a previous cycle, so a login re-arms the warning without touching the auth
hook; a send failure skips the stamp and retries the next night).

**#607 mail deliverability:** all three retention mails (`retention_skipped_user`,
`retention_skipped_admin`, `retention_warning_user`) deliberately carry **no** `List-Unsubscribe`
header and use the transactional sender identity (`SENDER_ADDRESS`), never the digest's — they are
DSE-mandated notices about the recipient's *own account*, not bulk/marketing mail, and offering an
unsubscribe promise the platform legally cannot honor would be worse than no header at all. This
is the `sendNotificationEmail` default (`kind` omitted, no `unsubscribeUrl`); see `services/mail.js`
and the sibling weekly-digest job (`jobs/digest.js`), which is the one call site that opts into
`kind: 'bulk'` + a real unsubscribe link.
