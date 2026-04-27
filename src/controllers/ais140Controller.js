const pool    = require('../config/db');
const { generateTrackingId, generateTicketId } = require('../utils/idGenerator');

/**
 * Validate AIS140 vehicle fields
 */
const validateAIS140Vehicle = (vd) => {
    const errors = [];
    if (!vd.vin)                                errors.push('vin is required');
    if (!vd.iccid)                              errors.push('iccid is required');
    if (!vd.device_imei)                        errors.push('device_imei is required');
    if (!vd.rto_office_code)                    errors.push('rto_office_code is required');
    if (!vd.rto_state)                          errors.push('rto_state is required');
    if (!vd.sim_expiry_date)                    errors.push('sim_expiry_date is required');
    if (!vd.certificate_validity_duration_in_year) errors.push('certificate_validity_duration_in_year is required');
    return errors;
};

/**
 * POST /api/ais140
 * Creates AIS140 cert tickets per VIN
 * Case 1: No order_tracking_id in request → generate new tracking_id (late request)
 * Case 2: order_tracking_id provided → use same tracking_id (created together)
 */
const createAIS140Request = async (req, res) => {
    try {
        const vehicles = req.body; // Array of { vehicle_details, customer_details }
        const clientId = req.client.client_id;

        if (!Array.isArray(vehicles) || vehicles.length === 0) {
            return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Request body must be a non-empty array.' }, data: null });
        }

        const results       = [];
        let   hasErrors     = false;
        let   hasSuccesses  = false;

        for (const item of vehicles) {
            const vd  = item.vehicle_details  || {};
            const cd  = item.customer_details || {};
            const vin = vd.vin;

            const validationErrors = validateAIS140Vehicle(vd);
            if (validationErrors.length > 0) {
                results.push({ vin: vin || null, ticket_no: null, validation_errors: validationErrors });
                hasErrors = true;
                continue;
            }

            // Determine tracking_id
            // Case 2: If vehicle exists in order_vehicles, use same tracking_id
            // Case 1: Otherwise, generate new one
            let trackingId    = generateTrackingId();
            let orderTrackingId = null;

            const [existing] = await pool.execute(
                `SELECT tracking_id, ais140_ticket_no FROM order_vehicles WHERE vin = ? LIMIT 1`, [vin]
            );

            if (existing.length) {
                // Case 2 — use same tracking_id as order
                trackingId      = existing[0].tracking_id;
                orderTrackingId = existing[0].tracking_id;

                // If ticket already exists, return existing ticket
                if (existing[0].ais140_ticket_no) {
                    results.push({ vin, ticket_no: existing[0].ais140_ticket_no, validation_errors: null });
                    hasSuccesses = true;
                    continue;
                }
            }

            const ticketNo = `AIS-${generateTicketId()}`;

            await pool.execute(
                `INSERT INTO ais140_tickets
                 (ticket_no, vin, tracking_id, order_tracking_id, vehicle_details, customer_details, status)
                 VALUES (?,?,?,?,?,?,'pending')`,
                [ticketNo, vin, trackingId, orderTrackingId, JSON.stringify(vd), JSON.stringify(cd)]
            );

            // Update order_vehicles if linked
            if (existing.length) {
                await pool.execute(`UPDATE order_vehicles SET ais140_ticket_no=? WHERE vin=?`, [ticketNo, vin]);
            }

            results.push({ vin, ticket_no: ticketNo, validation_errors: null });
            hasSuccesses = true;
        }

        const statusCode = hasErrors && hasSuccesses ? 206 : hasErrors ? 400 : 200;
        return res.status(statusCode).json({ err: null, data: results });

    } catch (err) {
        console.error('[createAIS140Request] Error:', err);
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

/**
 * POST /api/ais140/ticket-status
 * Get AIS140 ticket status by vin or ticket_no
 */
const getAIS140TicketStatus = async (req, res) => {
    try {
        const { vin, ticket_no } = req.body;

        if (!vin && !ticket_no) {
            return res.status(400).json({ err: { code: 'MISSING_PARAM', message: 'Provide vin or ticket_no.' }, data: null });
        }

        let rows;
        if (ticket_no) {
            [rows] = await pool.execute(`SELECT * FROM ais140_tickets WHERE ticket_no = ? LIMIT 1`, [ticket_no]);
        } else {
            [rows] = await pool.execute(`SELECT * FROM ais140_tickets WHERE vin = ? ORDER BY created_at DESC`, [vin]);
        }

        if (!rows.length) {
            return res.status(404).json({ err: { code: 404, message: 'Ticket not found' }, data: null });
        }

        const data = rows.map(t => ({
            ticket_no:              t.ticket_no,
            vin:                    t.vin,
            tracking_id:            t.tracking_id,
            order_tracking_id:      t.order_tracking_id,
            status:                 t.status,
            handler_details:        t.handler_details,
            certificate_file_name:  t.certificate_file_name,
            certificate_file_path:  t.certificate_file_path,
            validation_errors:      t.validation_errors,
            created_at:             t.created_at,
            updated_at:             t.updated_at,
        }));

        return res.status(200).json({ err: null, data: ticket_no ? data[0] : data });

    } catch (err) {
        console.error('[getAIS140TicketStatus] Error:', err);
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

module.exports = { createAIS140Request, getAIS140TicketStatus };
