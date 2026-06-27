/// <reference path="../../pb_data/types.d.ts" />

// Shared legal-consent guard (Issue #399, review round 2 / #1).
//
// The collection-API lock guard (onRecord{Create,Update,Delete}Request in
// legal.pb.js) does NOT fire for custom `routerAdd` routes — those run their own
// handler and write in superuser context. So any authenticated *mutating* custom
// route that should respect the decline-lock must call `isAuthLegalLocked(e.auth)`
// explicitly and refuse. (Read-only routes, and the user's own exit/data-rights
// routes — account deletion + export — are intentionally NOT gated by the lock.)
function isAuthLegalLocked(authRecord) {
	return !!(
		authRecord &&
		authRecord.collection().name === 'users' &&
		authRecord.getBool('legalLocked')
	)
}

module.exports = { isAuthLegalLocked }
