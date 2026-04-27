const pool = require('../config/db');

/**
 * GET /orders/status?trackingId=TRK...
 */
const getOrderStatus = async (req, res) => {
    try {
        const { trackingId } = req.query;

        // ── Step 4: Validate ──────────────────────────────────────
        if (!trackingId) {
            return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'trackingId is required' }, data: null });
        }

        // ── Step 5: Look up order ─────────────────────────────────
        const [orderRows] = await pool.execute(
            `SELECT * FROM orders WHERE tracking_id = ? LIMIT 1`, [trackingId]
        );

        if (!orderRows.length) {
            return res.status(404).json({ err: { code: 'NOT_FOUND', message: 'No order found for this trackingId' }, data: null });
        }

        const order = orderRows[0];
        const cd    = order.customer_details
            ? (typeof order.customer_details === 'string' ? JSON.parse(order.customer_details) : order.customer_details)
            : {};

        // ── Fetch all vehicle tickets ─────────────────────────────
        const [vehicleRows] = await pool.execute(
            `SELECT vin, ticket_id, status, stage_metadata, ais140_ticket_no, mining_ticket_no,
                    dispatch_location, registration_no, model, make
             FROM order_vehicles WHERE tracking_id = ? ORDER BY created_at ASC`,
            [trackingId]
        );

        // ── Step 6: Build stage-wise status per ticket ────────────
        const tickets = vehicleRows.map(v => {
            let stages = {};
            if (v.stage_metadata) {
                stages = typeof v.stage_metadata === 'string'
                    ? JSON.parse(v.stage_metadata)
                    : v.stage_metadata;
            }
            return {
                ticket_id:        v.ticket_id,
                vin:              v.vin,
                status:           v.status.charAt(0).toUpperCase() + v.status.slice(1).replace('_', ' '),
                ais140_ticket_no: v.ais140_ticket_no,
                mining_ticket_no: v.mining_ticket_no,
                stages,
            };
        });

        // ── Tab-wise counts (for dashboard/kanban view) ───────────
        const countByStatus = (rows) => ({
            pending:     rows.filter(r => r.status === 'pending').length,
            in_progress: rows.filter(r => r.status === 'in_progress').length,
            completed:   rows.filter(r => r.status === 'completed').length,
            on_hold:     rows.filter(r => r.status === 'on_hold').length,
            failed:      rows.filter(r => r.status === 'failed').length,
        });

        const [shipRows]   = await pool.execute(`SELECT status FROM shipment_tickets WHERE tracking_id=?`, [trackingId]);
        const [delRows]    = await pool.execute(`SELECT status FROM delivery_tickets WHERE tracking_id=?`, [trackingId]);
        const [instRows]   = await pool.execute(`SELECT status FROM installation_tickets WHERE tracking_id=?`, [trackingId]);
        const [ais140Rows] = await pool.execute(`SELECT status FROM ais140_tickets WHERE tracking_id=?`, [trackingId]);
        const [mineRows]   = await pool.execute(`SELECT status FROM mining_tickets WHERE tracking_id=?`, [trackingId]);

        const tabs = {
            orders:       countByStatus(vehicleRows),
            shipment:     countByStatus(shipRows),
            delivery:     countByStatus(delRows),
            installation: countByStatus(instRows),
        };
        if (ais140Rows.length) tabs.ais140  = countByStatus(ais140Rows);
        if (mineRows.length)   tabs.mining  = countByStatus(mineRows);

        // ── Step 7: Return response ───────────────────────────────
        return res.status(200).json({
            err:  null,
            data: {
                order_id:      order.tml_order_id,
                order_number:  order.order_number,
                tracking_id:   order.tracking_id,
                status:        order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('_', ' '),
                customer_name: cd.name  || null,
                customer_email: cd.email || null,
                total_vehicles: order.total_vehicles,
                created_at:    order.created_at,
                tickets,
                tabs,
            }
        });

    } catch (err) {
        console.error('[getOrderStatus] Error:', err);
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

module.exports = { getOrderStatus };
