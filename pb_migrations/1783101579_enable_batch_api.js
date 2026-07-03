/// <reference path="../pb_data/types.d.ts" />

// The frontend's integration machinery — the full sync (POST /api/sync), the per-item
// refresh (POST /api/refresh), and the institutional CSV import at /user/import — writes
// items exclusively via PocketBase batch requests (pb.createBatch()). The Batch API is
// disabled by default, so on a fresh instance every write batch fails with
// "Batch requests are not allowed" until a superuser flips the setting by hand.
// This migration enables it so new deployments work out of the box.
//
// The defaults for the other batch limits are sufficient and left untouched:
// maxRequests defaults to 50 and the largest batch the frontend sends is 50 operations
// (creates go 15/batch; updates/archives 50/batch — see the frontend's
// src/lib/server/integrations/core/write.ts and docs/operations/integration-sync.md).
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
