/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "resetPasswordTemplate": {
      "body": "<p>Hi, </p>\n<p>Klick auf die Schaltfläche, um dein Passwort zurückzusetzen.</p>\n<p>\n  <a class=\"btn\" href=\"http://localhost:5173/auth/reset/confirm?token={TOKEN}\" target=\"_blank\" rel=\"noopener\">Passwort zurücksetzen</a>\n</p>\n\n<p>\n  Liebe Grüße,<br/>\n  Timo & Matteo von {APP_NAME}\n</p>"
    }
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "resetPasswordTemplate": {
      "body": "<p>Hi, </p>\n<p>Klick auf die Schaltfläche, um dein Passwort zurückzusetzen.</p>\n<p>\n  <a class=\"btn\" href=\"https://allerleih.org/auth/reset/confirm?token={TOKEN}\" target=\"_blank\" rel=\"noopener\">Passwort zurücksetzen</a>\n</p>\n\n<p>\n  Liebe Grüße,<br/>\n  Timo & Matteo von {APP_NAME}\n</p>"
    }
  }, collection)

  return app.save(collection)
})
