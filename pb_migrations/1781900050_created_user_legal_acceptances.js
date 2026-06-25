/// <reference path="../pb_data/types.d.ts" />

// Immutable audit trail of platform legal-document consent decisions (ToS &
// privacy statement), versioned per document. One record per decision — created
// ONLY by the legal.pb.js hooks in superuser context (accept/decline) and the
// users onRecordAfterCreateSuccess hook (registration). createRule = null so a
// client can never forge a record under its own auth: version + bodySnapshot are
// taken server-side from the active legal_documents row, never from the request,
// and acceptedAt/userIp/userAgent are server-stamped (Issue #399, review #2).
// Records are never updated or deleted via the API (update/deleteRule = null) so
// the trail stays legally authoritative; `bodySnapshot` is exactly the shown text.
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "listRule": "@request.auth.id = user",
    "viewRule": "@request.auth.id = user",
    "updateRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "cascadeDelete": true,
        "collectionId": "hbacudkt08pfcy3",
        "help": "",
        "hidden": false,
        "id": "relation_la_user",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "user",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "help": "",
        "hidden": false,
        "id": "select_la_doctype",
        "maxSelect": 1,
        "name": "docType",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": ["tos", "privacy"]
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text_la_version",
        "max": 50,
        "min": 0,
        "name": "version",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "select_la_decision",
        "maxSelect": 1,
        "name": "decision",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": ["accepted", "declined"]
      },
      {
        "help": "",
        "hidden": false,
        "id": "date_la_acceptedat",
        "name": "acceptedAt",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      },
      {
        "convertURLs": false,
        "help": "",
        "hidden": false,
        "id": "editor_la_body",
        "maxSize": 0,
        "name": "bodySnapshot",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text_la_userip",
        "max": 100,
        "min": 0,
        "name": "userIp",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "text_la_useragent",
        "max": 500,
        "min": 0,
        "name": "userAgent",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "autodate_la_created",
        "name": "created",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "help": "",
        "hidden": false,
        "id": "autodate_la_updated",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      }
    ],
    "id": "pbc_legalacc001",
    "indexes": [
      "CREATE INDEX `idx_la_user_doctype_version` ON `user_legal_acceptances` (`user`, `docType`, `version`)"
    ],
    "name": "user_legal_acceptances",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_legalacc001");

  return app.delete(collection);
})
