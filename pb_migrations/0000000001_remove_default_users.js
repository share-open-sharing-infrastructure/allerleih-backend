/// <reference path="../pb_data/types.d.ts" />

/**
 * Remove the default PocketBase users collection.
 * 
 * PocketBase automatically creates a default "users" auth collection with id "_pb_users_auth_"
 * on first startup. Our schema uses a custom users collection with a different id ("hbacudkt08pfcy3"),
 * so we need to remove the default one before importing our schema.
 */
migrate((app) => {
  try {
    const defaultUsers = app.findCollectionByNameOrId("_pb_users_auth_")
    app.delete(defaultUsers)
  } catch (e) {
    // Collection doesn't exist or already deleted — safe to ignore
  }
}, (app) => {
  // Cannot reverse: the default collection would need to be recreated by PB itself
})
