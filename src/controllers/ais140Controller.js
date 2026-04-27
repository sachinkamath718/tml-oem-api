const pool    = require('../config/db');
const { generateTrackingId, generateTicketId } = require('../utils/idGenerator');

const validateAIS140Vehicle = (vd) => {
    const errors = [];
    if (!vd.vin)         errors.push('vin is required');
    if (!vd.iccid)       errors.push('iccid is required');
    if (!vd.device_imei) errors.push('device_imei is required');
    if (!vd.rto_office_code) errors.push('rto_office_code is required');
    if (!vd.rto_state)       errors.push('rto_state is required');
    if (!vd.sim_expiry_date) errors.push('sim_expiry_date is required');
    if (!vd.certificate_validity_duration_in_year) errors.push('certificate_validity_duration_in_year is required');
    return errors;
};

/**
 * POST /api/ais140
 * Case 1: VIN not in any order → new tracking_id
 * Case 2: VIN already in order → same tracking_id
 */
const createAIS140Request = async (req, res) => {
    try {
        const vehicles = req.body;

        if (!Array.isArray(vehicles) || vehicles.length === 0) {
            return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Request body must be a non-empty array.' }, data: null });
        }

        const results      = [];
        let   hasErrors    = false;
        let   hasSuccesses = false;

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

            // Case 2: VIN already in order → use same tracking_id
            let trackingId      = generateTrackingId();
            let orderTrackingId = null;

            const [existing] = await pool.execute(
                `SELECT tracking_id, ais140_ticket_no FROM order_vehicles WHERE vin = ? LIMIT 1`, [vin]
            );

            if (existing.length) {
                trackingId      = existing[0].tracking_id;
                orderTrackingId = existing[0].tracking_id;

                // Already has ticket → return existing
                if (existing[0].ais140_ticket_no) {
                    results.push({ vin, ticket_no: existing[0].ais140_ticket_no, validation_errors: null });
                    hasSuccesses = true;
                    continue;
                }
            }

            const ticketNo = `AIS-TKT-${generateTicketId()}`;

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
 * Body: [{ vin_no, ticket_no }]
 * Returns: [{ vin, status, certificate_file_names }]
 */
const getAIS140TicketStatus = async (req, res) => {
    try {
        const requests = req.body;

        if (!Array.isArray(requests) || requests.length === 0) {
            return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Request body must be a non-empty array of { vin_no, ticket_no }.' }, data: null });
        }

        const results = [];

        for (const item of requests) {
            const { vin_no, ticket_no } = item;
            if (!vin_no && !ticket_no) {
                results.push({ vin: null, status: null, certificate_file_names: [], error: 'vin_no or ticket_no required' });
                continue;
            }

            let rows;
            if (ticket_no) {
                [rows] = await pool.execute(`SELECT * FROM ais140_tickets WHERE ticket_no = ? LIMIT 1`, [ticket_no]);
            } else {
                [rows] = await pool.execute(`SELECT * FROM ais140_tickets WHERE vin = ? ORDER BY created_at DESC LIMIT 1`, [vin_no]);
            }

            if (!rows.length) {
                results.push({ vin: vin_no || null, ticket_no: ticket_no || null, status: null, certificate_file_names: [], error: 'Ticket not found' });
                continue;
            }

            const t = rows[0];
            results.push({
                vin:                    t.vin,
                ticket_no:              t.ticket_no,
                tracking_id:            t.tracking_id,
                status:                 t.status,
                certificate_file_names: t.certificate_file_name ? [t.certificate_file_name] : [],
                certificate_file_path:  t.certificate_file_path || null,
                handler_details:        t.handler_details || null,
                updated_at:             t.updated_at,
            });
        }

        return res.status(200).json({ err: null, data: results });

    } catch (err) {
        console.error('[getAIS140TicketStatus] Error:', err);
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

module.exports = { createAIS140Request, getAIS140TicketStatus };
