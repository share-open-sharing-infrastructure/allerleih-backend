/// <reference path="../pb_data/types.d.ts" />

// The frontend's integration machinery — the full sync (POST /api/sync), the per-item
// refresh (POST /api/refresh), and the institutional CSV import at /user/import — writes
// items exclusively via PocketBase batch requests (pb.createBatch()). The Batch API is
// disabled by default, so on a fresh instance every write batch fails with
// "Batch requests are not allowed" until a superuser flips the setting by hand.
// This migration enables it so new deployments work out of the box.
//
// The defaults for the other batch limits are left untouched, but note that
// maxRequests defaults to 50 and the largest batch the frontend sends is ALSO 50
// operations — exactly at the boundary. A future 51-op batch would silently start
// failing; if frontend batch sizes ever grow, raise maxRequests here too.
// (Creates go 15/batch; updates/archives 50/batch — see the frontend's
// src/lib/server/integrations/core/write.ts and docs/operations/integration-sync.md.)
//
// Caveat on down(): it disables the Batch API unconditionally, even if it had been
// enabled independently of this migration. Acceptable — downs aren't auto-run in prod.
migrate(
	(app) => {
		const settings = app.settings()
		settings.batch.enabled = true
		return app.save(settings)
	},
	(app) => {
		const settings = app.settings()
		settings.batch.enabled = false
		return app.save(settings)
	}
)
