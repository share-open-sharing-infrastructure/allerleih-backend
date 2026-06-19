/// <reference path="../pb_data/types.d.ts" />

// Privileged travel-time computation: reads owner coordinates from
// user_geolocations with backend rights, calls ORS, and returns only bucketed
// minutes. Coordinates never leave the backend, so the users/geolocation data
// stays unreadable for regular accounts.
routerAdd(
    'POST',
    '/api/travel-times',
    (e) => {
        const PROFILES = { foot: 'foot-walking', bicycle: 'cycling-regular', car: 'driving-car' }
        const body = e.requestInfo().body || {}
        const transportMode = body.transportMode
        const userLocation = body.userLocation
        const ownerIds = body.ownerIds

        if (!PROFILES[transportMode]) return e.json(400, { message: 'Invalid transport mode' })
        if (!userLocation || typeof userLocation.lat !== 'number' || typeof userLocation.lon !== 'number') {
            return e.json(400, { message: 'Invalid user location' })
        }
        if (!Array.isArray(ownerIds) || ownerIds.length === 0) return e.json(200, {})

        const owners = []
        for (const id of ownerIds) {
            try {
                const rec = $app.findFirstRecordByFilter('user_geolocations', 'user = {:u}', { u: id })
                const geo = JSON.parse(JSON.stringify(rec.get('geolocation')))
                if (geo && !(geo.lon === 0 && geo.lat === 0)) owners.push({ id: id, lon: geo.lon, lat: geo.lat })
            } catch (_) {
                // no stored location for this owner
            }
        }
        if (owners.length === 0) return e.json(200, {})

        const locations = [[userLocation.lon, userLocation.lat]].concat(owners.map((o) => [o.lon, o.lat]))
        let res
        try {
            res = $http.send({
                url: 'https://api.openrouteservice.org/v2/matrix/' + PROFILES[transportMode],
                method: 'POST',
                headers: {
                    Authorization: $os.getenv('ORS_API_KEY') || '',
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    locations: locations,
                    sources: [0],
                    destinations: owners.map((_, i) => i + 1),
                    metrics: ['duration'],
                }),
                timeout: 8,
            })
        } catch (err) {
            $app.logger().warn('[travel] ORS request failed', 'error', String(err))
            return e.json(200, {})
        }
        if (res.statusCode !== 200) {
            $app.logger().warn('[travel] ORS non-200', 'status', res.statusCode)
            return e.json(200, {})
        }

        const durations = (res.json && res.json.durations && res.json.durations[0]) || []
        const bucketize = (m) =>
            m < 5 ? 5 : m < 10 ? 10 : m < 15 ? 15 : m < 20 ? 20 : m < 25 ? 25 : m < 30 ? 30 : 35
        const result = {}
        owners.forEach((o, i) => {
            const sec = durations[i]
            if (sec !== null && sec !== undefined) result[o.id] = bucketize(Math.round(sec / 60))
        })
        return e.json(200, result)
    },
    $apis.requireAuth()
)
