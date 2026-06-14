/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "verificationTemplate": {
      "body": "<p>Hi,</p>\n<p>Schön, dich auf {APP_NAME} begrüßen zu dürfen!</p>\n<p>Klick auf die \"Verifizieren\"-Schaltfläche unten, um dein Konto zu verifizieren.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Verifizieren</a>\n</p>\n<p>\n  Happy Sharing!<br/>\n  Timo & Matteo von {APP_NAME}\n</p>"
    }
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "verificationTemplate": {
      "body": "<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Verify</a>\n</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>"
    }
  }, collection)

  return app.save(collection)
})
