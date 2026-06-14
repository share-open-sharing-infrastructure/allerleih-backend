/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "confirmEmailChangeTemplate": {
      "body": "<p>Hi,</p>\n<p>Klick auf die Schaltfläche unten, um die Änderung deiner Mail bei {APP_NAME} zu bestätigen.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Neue E-Mail bestätigen</a>\n</p>\n<p><i>Falls du keine Änderung der Mail angestoßen hast, kannst du diese Nachricht ignorieren.</i></p>\n<p>\n  Happy Sharing!<br/>\n  Dein {APP_NAME} Team\n</p>",
      "subject": "Bestätige deine neue {APP_NAME} email"
    }
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "confirmEmailChangeTemplate": {
      "body": "<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Confirm new email</a>\n</p>\n<p><i>If you didn't ask to change your email address, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
      "subject": "Confirm your {APP_NAME} new email address"
    }
  }, collection)

  return app.save(collection)
})
