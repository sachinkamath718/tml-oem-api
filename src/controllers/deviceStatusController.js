// Uses Node 18+ native fetch (available on Vercel)

const CVP_BASE_URL    = process.env.CVP_BASE_URL    || 'https://cvp-qa.api.tatamotors';
const CVP_CLIENT_ID   = process.env.CVP_CLIENT_ID   || 'itriangle';
const CVP_CLIENT_SECRET = process.env.CVP_CLIENT_SECRET || '6p0ifiTHAQTLIKRLwofKbryAcWfU3Htw';

// ── In-memory token cache ─────────────────────────────────────
let _cachedToken  = null;
let _tokenExpiry  = 0;

async function getToken() {
    if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

    const params = new URLSearchParams({
        client_id:     CVP_CLIENT_ID,
        client_secret: CVP_CLIENT_SECRET,
        grant_type:    'client_credentials',
    });

    const res  = await fetch(
        `${CVP_BASE_URL}/auth/realms/cvp/protocol/openid-connect/token`,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params }
    );
    const json = await res.json();

    if (!json.access_token) throw new Error('Failed to get CVP token: ' + JSON.stringify(json));

    _cachedToken = json.access_token;
    // Expire 60 s before actual expiry to avoid edge cases
    _tokenExpiry = Date.now() + ((json.expires_in || 3600) - 60) * 1000;
    return _cachedToken;
}

// ── Helper: is device online? ─────────────────────────────────
function deviceOnlineStatus(data) {
    const msgs = data.receivedMessages || [];
    const hasTelemetry = msgs.includes('TELEMETRY_DATA');
    const hasCan       = msgs.includes('CAN_DATA');

    if (hasTelemetry && hasCan) return 'Online';
    if (hasTelemetry || hasCan) return 'Partial';
    return 'Offline';
}

/**
 * GET /device-status?vehicle-id={vin}
 * Proxy to FleetEdge GET /device-status?vehicle-id={vin}
 */
const getDeviceStatus = async (req, res) => {
    const vin = req.query['vehicle-id'];
    if (!vin) {
        return res.status(400).json({ err: { code: 400, message: 'vehicle-id query param required' }, data: null });
    }

    try {
        const token   = await getToken();
        const apiRes  = await fetch(
            `${CVP_BASE_URL}/device-status?vehicle-id=${encodeURIComponent(vin)}`,
            { method: 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );

        if (!apiRes.ok) {
            const errBody = await apiRes.text();
            console.error(`[deviceStatus] FleetEdge error ${apiRes.status}: ${errBody}`);
            return res.status(apiRes.status).json({
                err: { code: apiRes.status, message: `FleetEdge returned ${apiRes.status}` },
                data: null,
            });
        }

        const data = await apiRes.json();
        return res.status(200).json({
            err: null,
            data: {
                vin,
                onlineStatus:                 deviceOnlineStatus(data),
                receivedMessages:             data.receivedMessages             || [],
                telemetryLastMessageDateTime: data.telemetryLastMessageDateTime || null,
                canLastMessageDateTime:       data.canLastMessageDateTime       || null,
                telemetryOdometer:            data.telemetryOdometer            ?? null,
                canOdometer:                  data.canOdometer                  ?? null,
            },
        });

    } catch (err) {
        console.error('[deviceStatus] Error:', err.message);
        return res.status(500).json({
            err:  { code: 'SERVER_ERROR', message: err.message },
            data: null,
        });
    }
};

module.exports = { getDeviceStatus };
