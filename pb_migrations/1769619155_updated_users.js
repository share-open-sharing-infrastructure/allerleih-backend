/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "authAlert": {
      "emailTemplate": {
        "body": "<p>Hi,</p>\n<p>Wir haben einen Login in deinem {APP_NAME} Account von einem neuen Ort festgestellt.</p>\n<p><em>{ALERT_INFO}</em></p>\n<p>Falls du das warst, musst du nichts weiter tun.</p>\n<p>Falls du das <strong>NICHT</strong> warst, ändere umgehend dein Passwort.</p>\n\n<p>\n  Happy sharing!<br/>\n  Dein {APP_NAME}-Team\n</p>"
      }
    }
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "authAlert": {
      "emailTemplate": {
        "body": "<p>Hello,</p>\n<p>We noticed a login to your {APP_NAME} account from a new location:</p>\n<p><em>{ALERT_INFO}</em></p>\n<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>\n<p>If this was you, you may disregard this email.</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>"
      }
    }
  }, collection)

  return app.save(collection)
})
