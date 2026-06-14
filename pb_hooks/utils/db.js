/// <reference path="../../pb_data/types.d.ts" />

/**
 * Wraps a function in a PocketBase RunInTransaction call.
 * If the inner function throws, the transaction is rolled back.
 *
 * Usage:
 *   const { wrapTransactional } = require(`${__hooks}/utils/db.js`)
 *   wrapTransactional(app, (txApp) => {
 *       // all operations here are atomic
 *       txApp.save(record)
 *   })
 */
function wrapTransactional(app, fn) {
    app.runInTransaction((txApp) => {
        fn(txApp)
    })
}

module.exports = {
    wrapTransactional,
}
