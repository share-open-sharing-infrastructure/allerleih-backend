/// <reference path="../pb_data/types.d.ts" />

/**
 * Main bootstrap hook — runs once when PocketBase starts.
 * Used for startup logging and global initialization.
 */
onBootstrap((e) => {
    const { LOG_LEVEL } = require(`${__hooks}/constants.js`)

    $app.logger().info('[server] AllerLeih backend hooks initialized', 'logLevel', LOG_LEVEL)

    e.next()
})
