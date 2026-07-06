/// <reference path="../pb_data/types.d.ts" />

// Trust graph guardrail on the `trusts` join collection. A row {truster, trustee}
// means "truster trusts trustee". The createRule already restricts `truster` to the
// authenticated user and the unique (truster, trustee) index prevents duplicates;
// this hook additionally rejects a self-trust edge, which would be a meaningless
// row (a user always sees their own items via the owner clause).
onRecordCreate((e) => {
    if (e.record.getString('truster') === e.record.getString('trustee')) {
        throw new BadRequestError('Man kann sich nicht selbst vertrauen.')
    }
    e.next()
}, 'trusts')
