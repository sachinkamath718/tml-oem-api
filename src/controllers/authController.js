const jwt  = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * POST /api/auth/token
 *
 * Request Body:
 * {
 *   "client_id": "tml-client-id",
 *   "client_secret": "tml-client-secret"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "access_token": "<jwt>",
 *     "token_type": "Bearer",
 *     "expires_in": 43200
 *   }
 * }
 */
async function generateToken(req, res) {
    const { client_id, client_secret } = req.body;

    // --- 1. Validate input ---
    if (!client_id || !client_secret) {
        return res.status(400).json({
            success: false,
            message: 'client_id and client_secret are required.',
        });
    }

    try {
        // --- 2. Look up the client ---
        const [rows] = await pool.query(
            'SELECT * FROM api_clients WHERE client_id = ? AND status = 1 LIMIT 1',
            [client_id]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid client_id or client is inactive.',
            });
        }

        const client = rows[0];

        // --- 3. Validate client_secret (plain comparison as per schema) ---
        if (client.client_secret !== client_secret) {
            return res.status(401).json({
                success: false,
                message: 'Invalid client_secret.',
            });
        }

        // --- 4. Create JWT payload ---
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

        // --- 5. Log the token ---
        await pool.query(
            `INSERT INTO token_logs
               (client_ref_id, access_token, token_type, expires_in, expires_at)
             VALUES (?, ?, 'Bearer', ?, ?)`,
            [client.id, access_token, EXPIRES_IN_SECONDS, expires_at]
        );

        // --- 6. Return token ---
        return res.status(200).json({
            success: true,
            message: 'Token generated successfully.',
            data: {
                access_token,
                token_type: 'Bearer',
                expires_in: EXPIRES_IN_SECONDS,
                expires_at: expires_at.toISOString(),
            },
        });

    } catch (err) {
        console.error('[generateToken] Error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}

module.exports = { generateToken };
