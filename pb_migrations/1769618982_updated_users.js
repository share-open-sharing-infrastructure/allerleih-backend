/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "resetPasswordTemplate": {
      "body": "<p>Hi, </p>\n<p>Klick auf die Schaltfläche, um dein Passwort zurückzusetzen.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Passwort zurücksetzen</a>\n</p>\n\n<p>\n  Liebe Grüße,<br/>\n  Timo & Matteo von {APP_NAME}\n</p>",
      "subject": "Setze dein {APP_NAME} Passwort zurück!"
    }
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "resetPasswordTemplate": {
      "body": "<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Reset password</a>\n</p>\n<p><i>If you didn't ask to reset your password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
      "subject": "Reset your {APP_NAME} password"
    }
  }, collection)

  return app.save(collection)
})
