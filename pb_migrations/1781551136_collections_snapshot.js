/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const snapshot = [
    {
      "authAlert": {
        "emailTemplate": {
          "body": "<p>Hi,</p>\n<p>Wir haben einen Login in deinem {APP_NAME} Account von einem neuen Ort festgestellt.</p>\n<p><em>{ALERT_INFO}</em></p>\n<p>Falls du das warst, musst du nichts weiter tun.</p>\n<p>Falls du das <strong>NICHT</strong> warst, ändere umgehend dein Passwort.</p>\n\n<p>\n  Happy sharing!<br/>\n  Dein {APP_NAME}-Team\n</p>",
          "subject": "Login von einem neuen Ort"
        },
        "enabled": true
      },
      "authRule": "",
      "authToken": {
        "duration": 1209600
      },
      "confirmEmailChangeTemplate": {
        "body": "<p>Hi,</p>\n<p>Klick auf die Schaltfläche unten, um die Änderung deiner Mail bei {APP_NAME} zu bestätigen.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Neue E-Mail bestätigen</a>\n</p>\n<p><i>Falls du keine Änderung der Mail angestoßen hast, kannst du diese Nachricht ignorieren.</i></p>\n<p>\n  Happy Sharing!<br/>\n  Dein {APP_NAME} Team\n</p>",
        "subject": "Bestätige deine neue {APP_NAME} email"
      },
      "createRule": "",
      "deleteRule": null,
      "emailChangeToken": {
        "duration": 1800
      },
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "cost": 10,
          "hidden": true,
          "id": "password901924565",
          "max": 0,
          "min": 8,
          "name": "password",
          "pattern": "",
          "presentable": false,
          "required": true,
          "system": true,
          "type": "password"
        },
        {
          "autogeneratePattern": "[a-zA-Z0-9_]{50}",
          "hidden": true,
          "id": "text2504183744",
          "max": 60,
          "min": 30,
          "name": "tokenKey",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "exceptDomains": null,
          "hidden": false,
          "id": "email3885137012",
          "name": "email",
          "onlyDomains": null,
          "presentable": false,
          "required": false,
          "system": true,
          "type": "email"
        },
        {
          "hidden": false,
          "id": "bool1547992806",
          "name": "emailVisibility",
          "presentable": false,
          "required": false,
          "system": true,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "bool256245529",
          "name": "verified",
          "presentable": false,
          "required": false,
          "system": true,
          "type": "bool"
        },
        {
          "autogeneratePattern": "users[0-9]{6}",
          "hidden": false,
          "id": "text4166911607",
          "max": 25,
          "min": 3,
          "name": "username",
          "pattern": "^[\\w\\p{L}][\\w\\p{L}\\.\\-]*$",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "ng0aklsf",
          "maxSelect": 2147483647,
          "minSelect": 0,
          "name": "trusts",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "geoPoint1587448267",
          "name": "geolocation",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "geoPoint"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text760939060",
          "max": 0,
          "min": 0,
          "name": "city",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text774300842",
          "max": 0,
          "min": 0,
          "name": "telegramUsername",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "bool840764222",
          "name": "telegramVisibleToTrustedOnly",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text656625768",
          "max": 0,
          "min": 0,
          "name": "signalLink",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "bool604880339",
          "name": "signalVisibleToTrustedOnly",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "select1776134756",
          "maxSelect": 1,
          "name": "preferredTransportMode",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "select",
          "values": [
            "car",
            "bicycle",
            "foot"
          ]
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text432700299",
          "max": 0,
          "min": 0,
          "name": "inviteCode",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "relation3607751814",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "invitedBy",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "bool2155960915",
          "name": "hasOnboarded",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "bool37905390",
          "name": "isInstitution",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "file4010923220",
          "maxSelect": 1,
          "maxSize": 0,
          "mimeTypes": [],
          "name": "profileImage",
          "presentable": false,
          "protected": false,
          "required": false,
          "system": false,
          "thumbs": [],
          "type": "file"
        },
        {
          "convertURLs": false,
          "hidden": false,
          "id": "editor3709889147",
          "maxSize": 0,
          "name": "bio",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "editor"
        },
        {
          "exceptDomains": [],
          "hidden": true,
          "id": "url2339978314",
          "name": "leihbackendUrl",
          "onlyDomains": [],
          "presentable": false,
          "required": false,
          "system": false,
          "type": "url"
        },
        {
          "autogeneratePattern": "",
          "hidden": true,
          "id": "text4020674105",
          "max": 0,
          "min": 0,
          "name": "leihbackendItemUrlTemplate",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "fileToken": {
        "duration": 120
      },
      "id": "hbacudkt08pfcy3",
      "indexes": [
        "CREATE UNIQUE INDEX `_hbacudkt08pfcy3_username_idx` ON `users` (username COLLATE NOCASE)",
        "CREATE UNIQUE INDEX `_hbacudkt08pfcy3_email_idx` ON `users` (`email`) WHERE `email` != ''",
        "CREATE UNIQUE INDEX `_hbacudkt08pfcy3_tokenKey_idx` ON `users` (`tokenKey`)"
      ],
      "listRule": "@request.auth.id != \"\"",
      "manageRule": null,
      "mfa": {
        "duration": 1800,
        "enabled": false,
        "rule": ""
      },
      "name": "users",
      "oauth2": {
        "enabled": false,
        "mappedFields": {
          "avatarURL": "",
          "id": "",
          "name": "",
          "username": "username"
        }
      },
      "otp": {
        "duration": 180,
        "emailTemplate": {
          "body": "<p>Hello,</p>\n<p>Your one-time password is: <strong>{OTP}</strong></p>\n<p><i>If you didn't ask for the one-time password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
          "subject": "OTP for {APP_NAME}"
        },
        "enabled": false,
        "length": 8
      },
      "passwordAuth": {
        "enabled": true,
        "identityFields": [
          "email",
          "username"
        ]
      },
      "passwordResetToken": {
        "duration": 1800
      },
      "resetPasswordTemplate": {
        "body": "<p>Hi, </p>\n<p>Klick auf die Schaltfläche, um dein Passwort zurückzusetzen.</p>\n<p>\n  <a class=\"btn\" href=\"https://allerleih.org/auth/reset/confirm?token={TOKEN}\" target=\"_blank\" rel=\"noopener\">Passwort zurücksetzen</a>\n</p>\n\n<p>\n  Liebe Grüße,<br/>\n  Timo & Matteo von {APP_NAME}\n</p>",
        "subject": "Setze dein {APP_NAME} Passwort zurück!"
      },
      "system": false,
      "type": "auth",
      "updateRule": "@request.auth.id = id && @request.body.isInstitution:isset = false",
      "verificationTemplate": {
        "body": "<p>Hi,</p>\n<p>Schön, dich auf {APP_NAME} begrüßen zu dürfen!</p>\n<p>Klick auf die \"Verifizieren\"-Schaltfläche unten, um dein Konto zu verifizieren.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Verifizieren</a>\n</p>\n<p>\n  Happy Sharing!<br/>\n  Timo & Matteo von {APP_NAME}\n</p>",
        "subject": "Verifiziere deine {APP_NAME} email"
      },
      "verificationToken": {
        "duration": 604800
      },
      "viewRule": "@request.auth.id != \"\""
    },
    {
      "createRule": "@request.auth.id != \"\" && (@request.body.externalUrl = \"\" || @request.auth.isInstitution = true)",
      "deleteRule": "@request.auth.id = owner",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "autogeneratePattern": "",
          "hidden": false,
          "id": "iqemrlnj",
          "max": 0,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "vfnowqok",
          "maxSelect": 1,
          "maxSize": 5242880,
          "mimeTypes": [],
          "name": "image",
          "presentable": false,
          "protected": false,
          "required": false,
          "system": false,
          "thumbs": [],
          "type": "file"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "pmh5o8zx",
          "max": 0,
          "min": 0,
          "name": "description",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "sps0x7bl",
          "max": 0,
          "min": 0,
          "name": "place",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "0wdg5keg",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "owner",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "bn1ywrfg",
          "name": "trusteesOnly",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "select2063623452",
          "maxSelect": 1,
          "name": "status",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "select",
          "values": [
            "available",
            "unavailable",
            "unknown"
          ]
        },
        {
          "hidden": false,
          "id": "select989021800",
          "maxSelect": 3,
          "name": "categories",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "select",
          "values": [
            "Bücher",
            "Spiele",
            "Küche",
            "Elektronik",
            "Für Kinder",
            "Sonstiges",
            "Werkzeug und Garten",
            "Freizeit und Sport",
            "Ton und Licht",
            "Reisen und Outdoor"
          ]
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text2809179246",
          "max": 0,
          "min": 0,
          "name": "externalId",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text890180046",
          "max": 0,
          "min": 0,
          "name": "externalUrl",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3586769666",
          "max": 0,
          "min": 0,
          "name": "externalImgUrl",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "id": "qyvc6pcix0fuqis",
      "indexes": [],
      "listRule": "@request.auth.id != \"\"",
      "name": "items",
      "system": false,
      "type": "base",
      "updateRule": "@request.auth.id = owner && (@request.body.externalUrl = \"\" || @request.auth.isInstitution = true)",
      "viewRule": "@request.auth.id != \"\""
    },
    {
      "createRule": "@request.auth.id != \"\"",
      "deleteRule": "@request.auth.id = from || @request.auth.id = to",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "autogeneratePattern": "",
          "hidden": false,
          "id": "9kpoxpwu",
          "max": 0,
          "min": 0,
          "name": "messageContent",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "eysfi4lp",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "from",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "lnh8coxs",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "to",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "id": "ozpasmnqgrdxiy6",
      "indexes": [],
      "listRule": "@request.auth.id = from || @request.auth.id = to ",
      "name": "messages",
      "system": false,
      "type": "base",
      "updateRule": "@request.auth.id = from || @request.auth.id = to",
      "viewRule": "@request.auth.id = from || @request.auth.id = to "
    },
    {
      "authAlert": {
        "emailTemplate": {
          "body": "<p>Hello,</p>\n<p>We noticed a login to your {APP_NAME} account from a new location:</p>\n<p><em>{ALERT_INFO}</em></p>\n<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>\n<p>If this was you, you may disregard this email.</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
          "subject": "Login from a new location"
        },
        "enabled": true
      },
      "authRule": "",
      "authToken": {
        "duration": 1209600
      },
      "confirmEmailChangeTemplate": {
        "body": "<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Confirm new email</a>\n</p>\n<p><i>If you didn't ask to change your email address, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
        "subject": "Confirm your {APP_NAME} new email address"
      },
      "createRule": null,
      "deleteRule": null,
      "emailChangeToken": {
        "duration": 1800
      },
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "cost": 0,
          "hidden": true,
          "id": "password901924565",
          "max": 0,
          "min": 8,
          "name": "password",
          "pattern": "",
          "presentable": false,
          "required": true,
          "system": true,
          "type": "password"
        },
        {
          "autogeneratePattern": "[a-zA-Z0-9]{50}",
          "hidden": true,
          "id": "text2504183744",
          "max": 60,
          "min": 30,
          "name": "tokenKey",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "exceptDomains": null,
          "hidden": false,
          "id": "email3885137012",
          "name": "email",
          "onlyDomains": null,
          "presentable": false,
          "required": true,
          "system": true,
          "type": "email"
        },
        {
          "hidden": false,
          "id": "bool1547992806",
          "name": "emailVisibility",
          "presentable": false,
          "required": false,
          "system": true,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "bool256245529",
          "name": "verified",
          "presentable": false,
          "required": false,
          "system": true,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": true,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": true,
          "type": "autodate"
        }
      ],
      "fileToken": {
        "duration": 120
      },
      "id": "pbc_3142635823",
      "indexes": [
        "CREATE UNIQUE INDEX `idx_tokenKey_pbc_3142635823` ON `_superusers` (`tokenKey`)",
        "CREATE UNIQUE INDEX `idx_email_pbc_3142635823` ON `_superusers` (`email`) WHERE `email` != ''"
      ],
      "listRule": null,
      "manageRule": null,
      "mfa": {
        "duration": 1800,
        "enabled": false,
        "rule": ""
      },
      "name": "_superusers",
      "oauth2": {
        "enabled": false,
        "mappedFields": {
          "avatarURL": "",
          "id": "",
          "name": "",
          "username": ""
        }
      },
      "otp": {
        "duration": 180,
        "emailTemplate": {
          "body": "<p>Hello,</p>\n<p>Your one-time password is: <strong>{OTP}</strong></p>\n<p><i>If you didn't ask for the one-time password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
          "subject": "OTP for {APP_NAME}"
        },
        "enabled": false,
        "length": 8
      },
      "passwordAuth": {
        "enabled": true,
        "identityFields": [
          "email"
        ]
      },
      "passwordResetToken": {
        "duration": 1800
      },
      "resetPasswordTemplate": {
        "body": "<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Reset password</a>\n</p>\n<p><i>If you didn't ask to reset your password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
        "subject": "Reset your {APP_NAME} password"
      },
      "system": true,
      "type": "auth",
      "updateRule": null,
      "verificationTemplate": {
        "body": "<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Verify</a>\n</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
        "subject": "Verify your {APP_NAME} email"
      },
      "verificationToken": {
        "duration": 259200
      },
      "viewRule": null
    },
    {
      "createRule": null,
      "deleteRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text455797646",
          "max": 0,
          "min": 0,
          "name": "collectionRef",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text127846527",
          "max": 0,
          "min": 0,
          "name": "recordRef",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text2462348188",
          "max": 0,
          "min": 0,
          "name": "provider",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text1044722854",
          "max": 0,
          "min": 0,
          "name": "providerId",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": true,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": true,
          "type": "autodate"
        }
      ],
      "id": "pbc_2281828961",
      "indexes": [
        "CREATE UNIQUE INDEX `idx_externalAuths_record_provider` ON `_externalAuths` (collectionRef, recordRef, provider)",
        "CREATE UNIQUE INDEX `idx_externalAuths_collection_provider` ON `_externalAuths` (collectionRef, provider, providerId)"
      ],
      "listRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId",
      "name": "_externalAuths",
      "system": true,
      "type": "base",
      "updateRule": null,
      "viewRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId"
    },
    {
      "createRule": null,
      "deleteRule": null,
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text455797646",
          "max": 0,
          "min": 0,
          "name": "collectionRef",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text127846527",
          "max": 0,
          "min": 0,
          "name": "recordRef",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text1582905952",
          "max": 0,
          "min": 0,
          "name": "method",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": true,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": true,
          "type": "autodate"
        }
      ],
      "id": "pbc_2279338944",
      "indexes": [
        "CREATE INDEX `idx_mfas_collectionRef_recordRef` ON `_mfas` (collectionRef,recordRef)"
      ],
      "listRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId",
      "name": "_mfas",
      "system": true,
      "type": "base",
      "updateRule": null,
      "viewRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId"
    },
    {
      "createRule": null,
      "deleteRule": null,
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text455797646",
          "max": 0,
          "min": 0,
          "name": "collectionRef",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text127846527",
          "max": 0,
          "min": 0,
          "name": "recordRef",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "cost": 8,
          "hidden": true,
          "id": "password901924565",
          "max": 0,
          "min": 0,
          "name": "password",
          "pattern": "",
          "presentable": false,
          "required": true,
          "system": true,
          "type": "password"
        },
        {
          "autogeneratePattern": "",
          "hidden": true,
          "id": "text3866985172",
          "max": 0,
          "min": 0,
          "name": "sentTo",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": true,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": true,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": true,
          "type": "autodate"
        }
      ],
      "id": "pbc_1638494021",
      "indexes": [
        "CREATE INDEX `idx_otps_collectionRef_recordRef` ON `_otps` (collectionRef, recordRef)"
      ],
      "listRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId",
      "name": "_otps",
      "system": true,
      "type": "base",
      "updateRule": null,
      "viewRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId"
    },
    {
      "createRule": null,
      "deleteRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text455797646",
          "max": 0,
          "min": 0,
          "name": "collectionRef",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text127846527",
          "max": 0,
          "min": 0,
          "name": "recordRef",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text4228609354",
          "max": 0,
          "min": 0,
          "name": "fingerprint",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": true,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": true,
          "type": "autodate"
        }
      ],
      "id": "pbc_4275539003",
      "indexes": [
        "CREATE UNIQUE INDEX `idx_authOrigins_unique_pairs` ON `_authOrigins` (collectionRef, recordRef, fingerprint)"
      ],
      "listRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId",
      "name": "_authOrigins",
      "system": true,
      "type": "base",
      "updateRule": null,
      "viewRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId"
    },
    {
      "createRule": "@request.auth.id != \"\"",
      "deleteRule": "@request.auth.id = itemOwner || @request.auth.id = requester",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "relation1820765950",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "requester",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "relation2612329880",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "itemOwner",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": "qyvc6pcix0fuqis",
          "hidden": false,
          "id": "relation3423333186",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "requestedItem",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": "ozpasmnqgrdxiy6",
          "hidden": false,
          "id": "relation3674349206",
          "maxSelect": 999,
          "minSelect": 0,
          "name": "messages",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "bool88140733",
          "name": "readByRequester",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "bool3531909232",
          "name": "readByOwner",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text1203507615",
          "max": 0,
          "min": 0,
          "name": "lendingStatus",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3392512568",
          "max": 0,
          "min": 0,
          "name": "counterfactual",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "id": "pbc_3709231855",
      "indexes": [],
      "listRule": "@request.auth.id = itemOwner || @request.auth.id = requester",
      "name": "conversations",
      "system": false,
      "type": "base",
      "updateRule": "@request.auth.id = itemOwner || @request.auth.id = requester",
      "viewRule": "@request.auth.id = itemOwner || @request.auth.id = requester"
    },
    {
      "createRule": "",
      "deleteRule": null,
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3179272750",
          "max": 0,
          "min": 0,
          "name": "feedbackMessage",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text46407801",
          "max": 0,
          "min": 0,
          "name": "route",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text154121870",
          "max": 0,
          "min": 0,
          "name": "device",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3583457535",
          "max": 0,
          "min": 0,
          "name": "viewportSize",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text1708506245",
          "max": 0,
          "min": 0,
          "name": "inputType",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3658682170",
          "max": 0,
          "min": 0,
          "name": "browser",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3813479993",
          "max": 0,
          "min": 0,
          "name": "browserVersion",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text277672171",
          "max": 0,
          "min": 0,
          "name": "feedbackLikes",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3926356707",
          "max": 0,
          "min": 0,
          "name": "feedbackSeverity",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "id": "pbc_2456230977",
      "indexes": [],
      "listRule": "",
      "name": "feedback",
      "system": false,
      "type": "base",
      "updateRule": null,
      "viewRule": null
    },
    {
      "createRule": "@request.auth.id = recipient || @request.auth.id = relatedId || @request.auth.id = sender",
      "deleteRule": "@request.auth.id = recipient || @request.auth.id = sender",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "relation1745156937",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "recipient",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "relation1593854671",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "sender",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text2363381545",
          "max": 0,
          "min": 0,
          "name": "type",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text200923267",
          "max": 0,
          "min": 0,
          "name": "relatedId",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3685223346",
          "max": 0,
          "min": 0,
          "name": "body",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "bool2555855207",
          "name": "read",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "id": "pbc_2301922722",
      "indexes": [],
      "listRule": "@request.auth.id = recipient || @request.auth.id = sender",
      "name": "notifications",
      "system": false,
      "type": "base",
      "updateRule": "@request.auth.id = recipient ",
      "viewRule": "@request.auth.id = recipient "
    },
    {
      "createRule": "user = @request.auth.id",
      "deleteRule": "user = @request.auth.id",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "relation2375276105",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "user",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3292663675",
          "max": 0,
          "min": 0,
          "name": "endpoint",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3303707132",
          "max": 0,
          "min": 0,
          "name": "p256dh",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text4175343705",
          "max": 0,
          "min": 0,
          "name": "auth",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "id": "pbc_1438754935",
      "indexes": [],
      "listRule": "@request.auth.id != \"\"",
      "name": "push_subscriptions",
      "system": false,
      "type": "base",
      "updateRule": "user = @request.auth.id",
      "viewRule": "@request.auth.id != \"\""
    },
    {
      "createRule": "",
      "deleteRule": null,
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text989021800",
          "max": 0,
          "min": 0,
          "name": "categories",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text616412651",
          "max": 0,
          "min": 0,
          "name": "query",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "id": "pbc_542531584",
      "indexes": [],
      "listRule": "",
      "name": "searches",
      "system": false,
      "type": "base",
      "updateRule": null,
      "viewRule": null
    },
    {
      "createRule": "",
      "deleteRule": null,
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text1053179562",
          "max": 0,
          "min": 0,
          "name": "destination",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text360723235",
          "max": 0,
          "min": 0,
          "name": "source_page",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": "qyvc6pcix0fuqis",
          "hidden": false,
          "id": "relation521872670",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "item",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "id": "pbc_671655951",
      "indexes": [],
      "listRule": "",
      "name": "outbound_clicks",
      "system": false,
      "type": "base",
      "updateRule": null,
      "viewRule": null
    },
    {
      "createRule": null,
      "deleteRule": null,
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "relation3479234172",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "owner",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3206337475",
          "max": 0,
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
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text724990059",
          "max": 0,
          "min": 0,
          "name": "title",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "convertURLs": false,
          "hidden": false,
          "id": "editor3685223346",
          "maxSize": 0,
          "name": "body",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "editor"
        },
        {
          "hidden": false,
          "id": "date3010959846",
          "max": "",
          "min": "",
          "name": "effectiveFrom",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "date"
        },
        {
          "hidden": false,
          "id": "bool1260321794",
          "name": "active",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "number743417707",
          "max": 150,
          "min": 0,
          "name": "minAge",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text2489460947",
          "max": 0,
          "min": 0,
          "name": "contactPerson",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "id": "pbc_3502153513",
      "indexes": [],
      "listRule": "",
      "name": "lending_terms",
      "system": false,
      "type": "base",
      "updateRule": null,
      "viewRule": ""
    },
    {
      "createRule": "@request.auth.id = user",
      "deleteRule": "@request.auth.id = user",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
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
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "relation2375276105",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "user",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": "pbc_3502153513",
          "hidden": false,
          "id": "relation2292334449",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "terms",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "date3321338401",
          "max": "",
          "min": "",
          "name": "acceptedAt",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "date"
        },
        {
          "hidden": false,
          "id": "bool2666088998",
          "name": "confirmedAdult",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text1261271175",
          "max": 0,
          "min": 0,
          "name": "fullNameSnapshot",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "convertURLs": false,
          "hidden": false,
          "id": "editor4168881313",
          "maxSize": 0,
          "name": "termsBody",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "editor"
        },
        {
          "hidden": false,
          "id": "autodate2990389176",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3332085495",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "id": "pbc_1241749386",
      "indexes": [],
      "listRule": "@request.auth.id = user",
      "name": "term_acceptances",
      "system": false,
      "type": "base",
      "updateRule": "@request.auth.id = user",
      "viewRule": "@request.auth.id = user"
    },
    {
      "createRule": null,
      "deleteRule": null,
      "fields": [
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 0,
          "min": 0,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "users[0-9]{6}",
          "hidden": false,
          "id": "_clone_FxTd",
          "max": 25,
          "min": 3,
          "name": "username",
          "pattern": "^[\\w\\p{L}][\\w\\p{L}\\.\\-]*$",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "convertURLs": false,
          "hidden": false,
          "id": "_clone_pE6b",
          "maxSize": 0,
          "name": "bio",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "editor"
        },
        {
          "hidden": false,
          "id": "_clone_I1GI",
          "name": "verified",
          "presentable": false,
          "required": false,
          "system": true,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "_clone_f9lr",
          "name": "isInstitution",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "_clone_4ty7",
          "maxSelect": 1,
          "maxSize": 0,
          "mimeTypes": [],
          "name": "profileImage",
          "presentable": false,
          "protected": false,
          "required": false,
          "system": false,
          "thumbs": [],
          "type": "file"
        },
        {
          "hidden": false,
          "id": "_clone_FtIS",
          "name": "telegramVisibleToTrustedOnly",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "_clone_ToWB",
          "name": "signalVisibleToTrustedOnly",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "_clone_e9yN",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "_clone_BLjt",
          "maxSelect": 2147483647,
          "minSelect": 0,
          "name": "trusts",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "_clone_ntu7",
          "max": 0,
          "min": 0,
          "name": "inviteCode",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        }
      ],
      "id": "pbc_3565108830",
      "indexes": [],
      "listRule": "",
      "name": "users_public",
      "system": false,
      "type": "view",
      "updateRule": null,
      "viewQuery": "SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.verified,\n  users.isInstitution,\n  users.profileImage,\n  users.telegramVisibleToTrustedOnly,\n  users.signalVisibleToTrustedOnly,\n  users.created,\n  users.trusts,\n  users.inviteCode\nFROM users",
      "viewRule": ""
    },
    {
      "createRule": null,
      "deleteRule": null,
      "fields": [
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 0,
          "min": 0,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "users[0-9]{6}",
          "hidden": false,
          "id": "_clone_3LMv",
          "max": 25,
          "min": 3,
          "name": "username",
          "pattern": "^[\\w\\p{L}][\\w\\p{L}\\.\\-]*$",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "convertURLs": false,
          "hidden": false,
          "id": "_clone_ZbW2",
          "maxSize": 0,
          "name": "bio",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "editor"
        },
        {
          "hidden": false,
          "id": "_clone_P3m6",
          "name": "geolocation",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "geoPoint"
        },
        {
          "hidden": false,
          "id": "_clone_p1ic",
          "maxSelect": 1,
          "maxSize": 0,
          "mimeTypes": [],
          "name": "profileImage",
          "presentable": false,
          "protected": false,
          "required": false,
          "system": false,
          "thumbs": [],
          "type": "file"
        },
        {
          "hidden": false,
          "id": "_clone_dAPk",
          "name": "isInstitution",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "_clone_lLZu",
          "maxSelect": 2147483647,
          "minSelect": 0,
          "name": "trusts",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        }
      ],
      "id": "pbc_1703855700",
      "indexes": [],
      "listRule": "@request.auth.id != \"\"",
      "name": "users_trusted",
      "system": false,
      "type": "view",
      "updateRule": null,
      "viewQuery": "SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.geolocation,\n  users.profileImage,\n  users.isInstitution,\n  users.trusts\nFROM users",
      "viewRule": "@request.auth.id != \"\""
    },
    {
      "createRule": null,
      "deleteRule": null,
      "fields": [
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3208210256",
          "max": 0,
          "min": 0,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "_clone_2svW",
          "max": 0,
          "min": 0,
          "name": "name",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "_clone_u6MS",
          "maxSelect": 1,
          "maxSize": 5242880,
          "mimeTypes": [],
          "name": "image",
          "presentable": false,
          "protected": false,
          "required": false,
          "system": false,
          "thumbs": [],
          "type": "file"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "_clone_TxIf",
          "max": 0,
          "min": 0,
          "name": "externalImgUrl",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "_clone_p0rm",
          "max": 0,
          "min": 0,
          "name": "externalUrl",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "_clone_Mjqj",
          "max": 0,
          "min": 0,
          "name": "description",
          "pattern": "",
          "presentable": false,
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "_clone_yA7I",
          "name": "trusteesOnly",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "_clone_YbjV",
          "maxSelect": 1,
          "name": "status",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "select",
          "values": [
            "available",
            "unavailable",
            "unknown"
          ]
        },
        {
          "hidden": false,
          "id": "_clone_aKTb",
          "maxSelect": 3,
          "name": "categories",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "select",
          "values": [
            "Bücher",
            "Spiele",
            "Küche",
            "Elektronik",
            "Für Kinder",
            "Sonstiges",
            "Werkzeug und Garten",
            "Freizeit und Sport",
            "Ton und Licht",
            "Reisen und Outdoor"
          ]
        },
        {
          "hidden": false,
          "id": "_clone_r597",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "relation1689669068",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "userId",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "autogeneratePattern": "users[0-9]{6}",
          "hidden": false,
          "id": "_clone_y7XL",
          "max": 25,
          "min": 3,
          "name": "username",
          "pattern": "^[\\w\\p{L}][\\w\\p{L}\\.\\-]*$",
          "presentable": false,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": "hbacudkt08pfcy3",
          "hidden": false,
          "id": "_clone_EQV7",
          "maxSelect": 2147483647,
          "minSelect": 0,
          "name": "trusts",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "_clone_ny6D",
          "name": "isInstitution",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "convertURLs": false,
          "hidden": false,
          "id": "_clone_HFy5",
          "maxSize": 0,
          "name": "bio",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "editor"
        },
        {
          "hidden": false,
          "id": "_clone_wmRK",
          "name": "verified",
          "presentable": false,
          "required": false,
          "system": true,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "_clone_dXBk",
          "maxSelect": 1,
          "maxSize": 0,
          "mimeTypes": [],
          "name": "profileImage",
          "presentable": false,
          "protected": false,
          "required": false,
          "system": false,
          "thumbs": [],
          "type": "file"
        },
        {
          "hidden": false,
          "id": "_clone_DNVB",
          "name": "userCreated",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "json65832145",
          "maxSize": 1,
          "name": "ownerHasLocation",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "json"
        }
      ],
      "id": "pbc_2268005888",
      "indexes": [],
      "listRule": "",
      "name": "items_public",
      "system": false,
      "type": "view",
      "updateRule": null,
      "viewQuery": "SELECT \n  items.id, items.name, items.image, items.externalImgUrl, items.externalUrl, items.description, items.trusteesOnly, items.status, items.categories, items.updated,\n  users.id as userId, users.username, users.trusts, users.isInstitution, users.bio, users.verified, users.profileImage, users.created as userCreated,\n    (\n    users.geolocation IS NOT NULL\n    AND users.geolocation != ''\n    AND NOT (\n      json_extract(users.geolocation, '$.lon') = 0\n      AND json_extract(users.geolocation, '$.lat') = 0\n    )\n  ) AS ownerHasLocation\nFROM items\nLEFT JOIN users on items.owner = users.id",
      "viewRule": ""
    }
  ];

  return app.importCollections(snapshot, false);
}, (app) => {
  return null;
})
