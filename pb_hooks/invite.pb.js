/// <reference path="../pb_data/types.d.ts" />

// Public invite lookup: resolve a code to {id, username} only, so guests can
// follow /invite/<code> without users_public exposing every code (enumeration).
routerAdd('GET', '/api/invite/{code}', (e) => {
    const code = e.request.pathValue('code')
    try {
        const user = $app.findFirstRecordByFilter('users', 'inviteCode = {:code}', { code: code })
        return e.json(200, { id: user.id, username: user.get('username') })
    } catch (err) {
        return e.json(404, { message: 'Invite code not found' })
    }
})
