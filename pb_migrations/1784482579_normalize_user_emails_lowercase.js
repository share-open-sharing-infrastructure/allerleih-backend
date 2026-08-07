/// <reference path="../pb_data/types.d.ts" />

// Issue #557 / allerleih-backend#41 — heal existing mixed-case emails.
//
// PocketBase stored emails verbatim (case-sensitive matching, no normalization on save),
// so any pre-existing account registered with a capital letter (`Julika7@…`) is unreachable
// by login/password-reset, which send the lower-case address the user types. The new
// account.pb.js create/update hooks stop NEW rows from drifting; this one-off migration
// lower-cases the rows that already drifted, in both `users` and the `deleted_accounts`
// audit store (so a restore doesn't reintroduce a bad-case row).
//
// COLLISION SAFETY: two accounts whose emails differ only in case (`Foo@x.de` + `foo@x.de`)
// collapse onto one address when lower-cased, which would violate the users unique-email
// index and merge two identities. `planEmailNormalization` detects such groups and reports
// them as collisions; we SKIP + WARN those (one line per group, with the record ids so an
// operator can resolve them by hand in the admin UI) and normalize only the safe, lone rows.
//
// The plan/normalize logic lives in pb_hooks/utils/email.js and is shared verbatim with the
// runtime hook and the unit tests (tests/email-normalization.test.mjs) — migrations can
// `require(`${__hooks}/…`)` just like hooks. NOTE: like every data-copy migration in this
// repo, the loop itself is a no-op under `npm test` (the harness applies migrations to an
// EMPTY db before any user exists); the shared function is what the tests actually exercise.
//
// DOWN: intentionally a no-op — lower-casing is lossy (the original casing is gone), so there
// is nothing to restore.
migrate(
    (app) => {
        const { planEmailNormalization } = require(`${__hooks}/utils/email.js`)

        for (const collectionName of ['users', 'deleted_accounts']) {
            let records
            try {
                records = app.findAllRecords(collectionName)
            } catch (err) {
                app.logger().warn(
                    '[557] email normalization: collection not readable, skipped',
                    'collection',
                    collectionName,
                    'error',
                    String(err)
                )
                continue
            }

            const byId = new Map(records.map((r) => [r.id, r]))
            const { updates, collisions } = planEmailNormalization(
                records.map((r) => ({ id: r.id, email: r.getString('email') }))
            )

            for (const collision of collisions) {
                app.logger().warn(
                    '[557] email normalization: skipped case-collision (resolve manually)',
                    'collection',
                    collectionName,
                    'normalized',
                    collision.normalized,
                    'ids',
                    collision.ids.join(',')
                )
            }

            let changed = 0
            for (const upd of updates) {
                const rec = byId.get(upd.id)
                if (!rec) continue
                rec.set('email', upd.to)
                app.save(rec)
                changed++
            }

            app.logger().info(
                '[557] email normalization done',
                'collection',
                collectionName,
                'normalized',
                changed,
                'collisionsSkipped',
                collisions.length
            )
        }
    },
    (app) => {
        // No-op: lower-casing an email is not reversible (the original casing is not stored
        // anywhere), so there is nothing to restore on down.
    }
)
