/// <reference path="../pb_data/types.d.ts" />

/**
 * Lending-requirements gate — authoritative enforcement of lender-defined
 * borrower requirements when a borrow request (conversation) is created.
 *
 * A lender configures their requirements per account in `lending_requirements`
 * (one row per owner). This hook runs on every conversation create request and
 * aborts it if the requester does not satisfy an *enabled* requirement. The
 * frontend performs the same checks for UX (disabling the request button and
 * explaining what's missing), but this hook is the source of truth — it cannot
 * be bypassed by POSTing directly to the API.
 *
 * On failure it throws a 400 whose message starts with the machine-readable code
 * "lending_requirement_unmet" followed by the unmet requirement keys (PocketBase
 * reserves the BadRequestError `data` argument for field-validation errors, so we
 * encode the keys into the message instead). The frontend does its own friendly
 * pre-check, so this is primarily a tamper-proof safety net. Trust/visibility
 * gating stays in the conversations createRule (migration
 * 1781900002_harden_conversations_create.js).
 *
 * SECURITY: the owner whose requirements we enforce is derived from the item's
 * real owner (`requestedItem.owner`), NEVER from the client-supplied `itemOwner`
 * field — otherwise a borrower could POST a forged `itemOwner` (e.g. their own id,
 * which has no requirements) and bypass the gate. We also overwrite `itemOwner`
 * with the true owner so a forged value can't corrupt the lender's inbox. The
 * createRule additionally binds `itemOwner = requestedItem.owner` (defense in depth).
 *
 * Extending: to add a new requirement type, add a column to the
 * `lending_requirements` collection (migration) and a registry entry below.
 * Keep the keys/logic in sync with the frontend helper
 * (allerleih/src/lib/server/lendingRequirements.ts).
 */
onRecordCreateRequest((e) => {
    const conversation = e.record
    const requesterId = conversation.get('requester')
    const itemId = conversation.get('requestedItem')

    // Missing relations → let the normal collection validation report it.
    if (!itemId || !requesterId) {
        e.next()
        return
    }

    // Resolve the TRUE owner from the item — never trust the client-supplied
    // `itemOwner`. If the item can't be loaded, defer to normal validation.
    let item
    try {
        item = $app.findRecordById('items', itemId)
    } catch (_) {
        e.next()
        return
    }
    const ownerId = item.get('owner')

    // Correct a forged/stale itemOwner so it always matches the item's owner.
    if (conversation.get('itemOwner') !== ownerId) {
        conversation.set('itemOwner', ownerId)
    }

    // No requirements configured for this owner → nothing extra to enforce.
    let req
    try {
        req = $app.findFirstRecordByFilter('lending_requirements', 'owner = {:o}', { o: ownerId })
    } catch (_) {
        e.next()
        return
    }

    let borrower
    try {
        borrower = $app.findRecordById('users', requesterId)
    } catch (_) {
        // Can't resolve the borrower for an enabled-requirements owner → fail
        // CLOSED (the requester normally always exists, since the createRule binds
        // requester = auth.id; a failure here is an anomaly, not "no requirements").
        throw new BadRequestError('lending_requirement_unmet: borrower_unresolved')
    }

    // Requirement registry. `enabled` = did the owner switch it on?
    // `met` = does the borrower satisfy it?
    const registry = {
        verifiedEmail: {
            enabled: (r) => !!r.get('requireVerifiedEmail'),
            met: (u) => !!u.get('verified'),
        },
        address: {
            // #389: borrower must have an address on file. `city` is the canonical
            // address field (the profile AddressInput writes it); checked on every
            // request, so a borrower can't delete it afterwards and still borrow.
            enabled: (r) => !!r.get('requireAddress'),
            met: (u) => ((u.get('city') || '').trim() !== ''),
        },
        // Drop-in additions (see plan): requireAcceptedTerms,
        // minOwnItems / minCompletedTransactions.
    }

    const unmet = []
    for (const key in registry) {
        const rule = registry[key]
        if (rule.enabled(req) && !rule.met(borrower)) {
            unmet.push(key)
        }
    }

    if (unmet.length > 0) {
        throw new BadRequestError('lending_requirement_unmet: ' + unmet.join(','))
    }

    e.next()
}, 'conversations')
