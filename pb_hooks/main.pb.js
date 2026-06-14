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

/**
 * Custom log formatting (optional, same pattern as leihbackend_AL).
 * Intercepts PocketBase's internal log writes and prints them to stdout
 * filtered by LOG_LEVEL.
 *
 * Log levels: 1=DEBUG, 2=INFO, 3=WARN, 4=ERROR
 */
onModelCreate((e) => {
    const { LOG_LEVEL } = require(`${__hooks}/constants.js`)

    const log = e.model
    const level = log.get('level') || 4 // default to ERROR
    const message = log.get('message') || ''

    if (level >= LOG_LEVEL) {
        const prefix = ['', '[DBG]', '[INF]', '[WRN]', '[ERR]'][level] || '[???]'
        console.log(`${prefix} ${message}`)
    }

    e.next()
}, '_logs')
