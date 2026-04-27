const jwt  = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * POST /api/auth/token
 * Content-Type: application/x-www-form-urlencoded
 *
 * Request Body:
 *   client_id=tml-client-id
 *   client_secret=tml-client-secret
 *   grant_type=client_credentials
 *
 * Success Response (200):
 * {
 *   "message": "Token generated successfully",
 *   "access_token": "<jwt>",
 *   "expires_in": 43200,
 *   "token_type": "Bearer"
 * }
 *
 * Error Response (400/401):
 * {
 *   "message": "...",
 *   "access_token": null,
 *   "expires_in": null,
 *   "token_type": null
 * }
 */
async function generateToken(req, res) {
    const { client_id, client_secret, grant_type } = req.body;

    // ── Step 3: Validate mandatory fields ────────────────────────
    if (!client_id || !client_secret || !grant_type) {
        return res.status(400).json({
            message:      'Invalid request parameters',
            access_token: null,
            expires_in:   null,
            token_type:   null,
        });
    }

    if (grant_type !== 'client_credentials') {
        return res.status(400).json({
            message:      'Invalid request parameters',
            access_token: null,
            expires_in:   null,
            token_type:   null,
        });
    }

    try {
        // ── Step 4: Validate credentials from DB ─────────────────
        const [rows] = await pool.query(
            `SELECT * FROM api_clients
             WHERE client_id = ? AND client_secret = ? AND status = 1
             LIMIT 1`,
            [client_id, client_secret]
        );

        // ── Step 5: If credentials invalid ───────────────────────
        if (rows.length === 0) {
            return res.status(401).json({
                message:      'Invalid credentials',
                access_token: null,
                expires_in:   null,
                token_type:   null,
            });
        }

        const client = rows[0];

        // ── Step 7 & 8: Create JWT payload & sign ─────────────────
        const EXPIRES_IN_SECONDS = 43200; // 12 hours

        const payload = {
            client_id:     client.client_id,
            client_name:   client.client_name,
            client_ref_id: client.id,
        };

        const access_token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: EXPIRES_IN_SECONDS,
        });

        const expires_at = new Date(Date.now() + EXPIRES_IN_SECONDS * 1000);

        // ── Step 9: Store token in DB ─────────────────────────────
        await pool.query(
            `INSERT INTO token_logs
               (client_ref_id, access_token, token_type, expires_in, expires_at)
             VALUES (?, ?, 'Bearer', ?, ?)`,
            [client.id, access_token, EXPIRES_IN_SECONDS, expires_at]
        );

        // ── Step 10: Return success response ──────────────────────
        return res.status(200).json({
            message:      'Token generated successfully',
            access_token,
            expires_in:   EXPIRES_IN_SECONDS,
            token_type:   'Bearer',
        });

    } catch (err) {
        console.error('[generateToken] Error:', err);
        return res.status(500).json({
            message:      'Internal server error',
            access_token: null,
            expires_in:   null,
            token_type:   null,
        });
    }
}

module.exports = { generateToken };
