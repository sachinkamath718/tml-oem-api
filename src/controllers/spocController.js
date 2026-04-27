const pool = require('../config/db');

/**
 * PUT /api/orders/fitment/spoc
 * Updates SPOC details for an order by tracking_id
 */
const updateSpoc = async (req, res) => {
    try {
        const { tracking_id, name, contact_no, email } = req.body;

        if (!tracking_id || !name || !contact_no || !email) {
            return res.status(400).json({
                err: { code: 'INVALID_DATA', message: 'tracking_id, name, contact_no, and email are required.' },
                data: null
            });
        }

        // Verify tracking_id exists
        const [orders] = await pool.execute(`SELECT id FROM orders WHERE tracking_id = ? LIMIT 1`, [tracking_id]);
        if (!orders.length) {
            return res.status(404).json({ success: false, err: { code: 404, message: 'Tracking ID not found' }, data: null });
        }

        // Upsert SPOC
        const [existing] = await pool.execute(`SELECT id FROM spoc_details WHERE tracking_id = ? LIMIT 1`, [tracking_id]);
        if (existing.length) {
            await pool.execute(
                `UPDATE spoc_details SET name=?, contact_no=?, email=?, updated_at=NOW() WHERE tracking_id=?`,
                [name, contact_no, email, tracking_id]
            );
        } else {
            await pool.execute(
                `INSERT INTO spoc_details (tracking_id, name, contact_no, email) VALUES (?,?,?,?)`,
                [tracking_id, name, contact_no, email]
            );
        }

        return res.status(200).json({
            err:  null,
            data: { tracking_id, updated: true }
        });

    } catch (err) {
        console.error('[updateSpoc] Error:', err);
        return res.status(500).json({ success: false, err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

module.exports = { updateSpoc };

