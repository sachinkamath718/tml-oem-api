const pool = require('../config/db');

const updateSpoc = async (req, res) => {
    try {
        const { tracking_id, name, contact_no, email } = req.body;

        if (!tracking_id || !name || !contact_no || !email) {
            return res.status(404).json({ err: { code: 404, message: 'Tracking ID not found' }, data: null });
        }

        const vehicles = await pool.query(
            `SELECT id FROM order_vehicles WHERE tracking_id = $1 LIMIT 1`, [tracking_id]
        );
        if (!vehicles.rows.length) {
            return res.status(404).json({ err: { code: 404, message: 'Tracking ID not found' }, data: null });
        }

        const existing = await pool.query(
            `SELECT id FROM spoc_details WHERE tracking_id = $1 LIMIT 1`, [tracking_id]
        );

        if (existing.rows.length) {
            await pool.query(
                `UPDATE spoc_details SET name=$1, contact_no=$2, email=$3, updated_at=NOW() WHERE tracking_id=$4`,
                [name, contact_no, email, tracking_id]
            );
        } else {
            await pool.query(
                `INSERT INTO spoc_details (tracking_id, name, contact_no, email) VALUES ($1,$2,$3,$4)`,
                [tracking_id, name, contact_no, email]
            );
        }

        return res.status(200).json({ err: null, data: { tracking_id, updated: true } });

    } catch (err) {
        console.error('[updateSpoc] Error:', err);
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

module.exports = { updateSpoc };
