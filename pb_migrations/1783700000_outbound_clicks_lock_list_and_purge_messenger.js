/// <reference path="../pb_data/types.d.ts" />

// Issue #520: outbound_clicks had listRule = "" (public), so anyone could read
// every logged click via GET /api/collections/outbound_clicks/records — including
// users' Signal/Telegram deep links (personal contact data, and for trustees-only
// handles outright private). Two-part fix, mirrored by a frontend change that stops
// persisting messenger links in the first place:
//   1. Lock the list rule to superusers only (null). createRule stays "" so
//      unauthenticated item/footer clicks can still be logged; nobody but an admin
//      can read the table back.
//   2. Purge the already-exposed messenger rows.

const MESSENGER_HOSTS = ['t.me', 'telegram.me', 'signal.me', 'signal.group']

// Host (lower-cased, www-stripped) of an https destination, or '' if unparseable.
function hostOf(url) {
    const m = /^https?:\/\/([^/?#]+)/i.exec(url || '')
    // Drop any :port and userinfo@ before comparing to the host allow-list.
    const authority = m ? m[1].toLowerCase() : ''
    const host = authority.split('@').pop().split(':')[0]
    return host.replace(/^www\./, '')
}

function isMessengerDestination(url) {
    return MESSENGER_HOSTS.indexOf(hostOf(url)) !== -1
}

// Exposed for a fast node:test unit test (tests/messenger-host.test.mjs) so the
// exact purge predicate is covered — the integration harness applies this
// migration against an empty table, so the delete loop is never exercised there.
// Harmless in the PocketBase JSVM (migrations don't read their own exports).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { hostOf, isMessengerDestination, MESSENGER_HOSTS }
}

// `migrate` is a JSVM global; it is absent under Node, so guarding the call lets
// the test import this file for the helpers above without registering/running it.
if (typeof migrate !== 'undefined') {
    migrate(
        (app) => {
            const collection = app.findCollectionByNameOrId('outbound_clicks')
            collection.listRule = null
            app.save(collection)

            const records = app.findAllRecords('outbound_clicks')
            for (const record of records) {
                if (isMessengerDestination(record.getString('destination'))) {
                    app.delete(record)
                }
            }
        },
        (app) => {
            // Restore the public list rule. Purged rows are not recoverable (and were
            // sensitive by design), so the down migration only reverts the rule.
            const collection = app.findCollectionByNameOrId('outbound_clicks')
            collection.listRule = ''
            app.save(collection)
        }
    )
}
