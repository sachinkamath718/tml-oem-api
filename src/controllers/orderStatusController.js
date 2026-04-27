const pool = require('../config/db');

/**
 * GET /api/orders/status?trackingId=TRK...
 * Returns tab-wise ticket status breakdown (Orders, Shipment, Delivery, Installation, AIS140, Mining)
 */
const getOrderStatus = async (req, res) => {
    try {
        const { trackingId, order_number, vin } = req.query;

        if (!trackingId && !order_number && !vin) {
            return res.status(400).json({ err: { code: 'MISSING_PARAM', message: 'Provide trackingId, order_number, or vin.' }, data: null });
        }

        // ── Find order ────────────────────────────────────────────
        let orderRows;
        if (trackingId) {
            [orderRows] = await pool.execute(`SELECT * FROM orders WHERE tracking_id = ? LIMIT 1`, [trackingId]);
        } else if (order_number) {
            [orderRows] = await pool.execute(`SELECT * FROM orders WHERE order_number = ? LIMIT 1`, [order_number]);
        } else {
            const [vRows] = await pool.execute(`SELECT order_id FROM order_vehicles WHERE vin = ? LIMIT 1`, [vin]);
            if (!vRows.length) return res.status(404).json({ err: { code: 404, message: 'Tracking ID not found' }, data: null });
            [orderRows] = await pool.execute(`SELECT * FROM orders WHERE id = ? LIMIT 1`, [vRows[0].order_id]);
        }

        if (!orderRows.length) {
            return res.status(404).json({ err: { code: 404, message: 'Tracking ID not found' }, data: null });
        }

        const order = orderRows[0];
        const tid   = order.tracking_id;

        // ── Helper: count tickets by status ───────────────────────
        const countByStatus = (rows) => {
            const counts = { pending: 0, in_progress: 0, completed: 0, on_hold: 0, failed: 0 };
            rows.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
            return counts;
        };

        // ── Fetch all tabs in parallel ─────────────────────────────
        const [
            [orderVehicles],
            [shipmentRows],
            [deliveryRows],
            [installRows],
            [ais140Rows],
            [miningRows],
            [historyRows],
        ] = await Promise.all([
            pool.execute(`SELECT vin, ticket_id as ticket_no, status, ais140_ticket_no, mining_ticket_no, dispatch_location FROM order_vehicles WHERE tracking_id = ?`, [tid]),
            pool.execute(`SELECT ticket_no, vin, status FROM shipment_tickets WHERE tracking_id = ?`, [tid]),
            pool.execute(`SELECT ticket_no, vin, status FROM delivery_tickets WHERE tracking_id = ?`, [tid]),
            pool.execute(`SELECT ticket_no, vin, status FROM installation_tickets WHERE tracking_id = ?`, [tid]),
            pool.execute(`SELECT ticket_no, vin, status FROM ais140_tickets WHERE tracking_id = ?`, [tid]),
            pool.execute(`SELECT mining_ticket_no as ticket_no, vin, status FROM mining_tickets WHERE tracking_id = ?`, [tid]),
            pool.execute(`SELECT stage, to_status as status, created_at, metadata FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC`, [order.id]),
        ]);

        // ── Build stage tracking_info ─────────────────────────────
        const tracking_info = historyRows.map(h => ({
            stage:      h.stage,
            status:     h.status,
            updated_at: new Date(h.created_at).getTime(),
            metadata:   h.metadata ? (typeof h.metadata === 'string' ? JSON.parse(h.metadata) : h.metadata) : {},
        }));

        // ── Build tab-wise response ───────────────────────────────
        const tabs = {
            orders: {
                counts:  countByStatus(orderVehicles),
                tickets: orderVehicles.map(v => ({
                    ticket_no:        v.ticket_no,
                    vin:              v.vin,
                    status:           v.status,
                    dispatch_location: v.dispatch_location,
                })),
            },
            shipment: {
                counts:  countByStatus(shipmentRows),
                tickets: shipmentRows.map(v => ({ ticket_no: v.ticket_no, vin: v.vin, status: v.status })),
            },
            delivery: {
                counts:  countByStatus(deliveryRows),
                tickets: deliveryRows.map(v => ({ ticket_no: v.ticket_no, vin: v.vin, status: v.status })),
            },
            installation: {
                counts:  countByStatus(installRows),
                tickets: installRows.map(v => ({ ticket_no: v.ticket_no, vin: v.vin, status: v.status })),
            },
        };

        // AIS140 tab — only if tickets exist
        if (ais140Rows.length > 0) {
            tabs.ais140 = {
                counts:  countByStatus(ais140Rows),
                tickets: ais140Rows.map(v => ({ ticket_no: v.ticket_no, vin: v.vin, status: v.status })),
            };
        }

        // Mining tab — only if tickets exist
        if (miningRows.length > 0) {
            tabs.mining = {
                counts:  countByStatus(miningRows),
                tickets: miningRows.map(v => ({ ticket_no: v.ticket_no, vin: v.vin, status: v.status })),
            };
        }

        return res.status(200).json({
            err:  null,
            data: {
                order_number:     order.order_number,
                tml_order_id:     order.tml_order_id,
                tracking_id:      order.tracking_id,
                overall_status:   order.status,
                total_vehicles:   order.total_vehicles,
                customer_details: order.customer_details,
                tracking_info,
                tabs,
            }
        });

    } catch (err) {
        console.error('[getOrderStatus] Error:', err);
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

module.exports = { getOrderStatus };
