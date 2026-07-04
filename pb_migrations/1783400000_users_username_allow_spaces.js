/// <reference path="../pb_data/types.d.ts" />

// Issue #457: usernames could not contain spaces (pattern rejected them) and were
// capped at 25 chars, which is impractical for institution display names like
// "Ratsbücherei Lüneburg" or "die Fleckenbühler Hof Fleckenbühl gGmbH". Widen the
// `username` pattern to allow internal spaces (no leading/trailing space) and raise
// the max length to 50. The frontend normalizes (trim + collapse whitespace) and
// validates against the same rules; this pattern is the server-side backstop for
// direct API writes. `min` (3) and the case-insensitive unique index are unchanged.
migrate(
	(app) => {
		const c = app.findCollectionByNameOrId('users')
		const f = c.fields.getByName('username')
		f.pattern = '^[\\p{L}\\w][\\p{L}\\w .\\-]*[\\p{L}\\w.\\-]$'
		f.max = 50
		app.save(c)
	},
	(app) => {
		const c = app.findCollectionByNameOrId('users')
		const f = c.fields.getByName('username')
		f.pattern = '^[\\w\\p{L}][\\w\\p{L}\\.\\-]*$'
		f.max = 25
		app.save(c)
	}
)
