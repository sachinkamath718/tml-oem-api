const pool    = require('../config/db');
const { generateTrackingId, generateTicketId } = require('../utils/idGenerator');

const validateMiningVehicle = (vd) => {
    const errors = [];
    if (!vd.vin)              errors.push('Invalid VIN');
    if (!vd.iccid)            errors.push('Missing POI document');
    if (!vd.device_imei)      errors.push('Missing device IMEI');
    if (!vd.department)       errors.push('Invalid RTO code');
    if (!vd.sim_expiry_date)  errors.push('Missing SIM expiry date');
    if (!vd.duration_in_year) errors.push('Missing certificate validity duration');
    return errors;
};

/**
 * POST /api/mining
 */
const createMiningRequest = async (req, res) => {
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

            const validationErrors = validateMiningVehicle(vd);
            if (validationErrors.length > 0) {
                results.push({ vin: vin || null, mining_ticket_no: null, validation_errors: validationErrors });
                hasErrors = true;
                continue;
            }

            let trackingId      = generateTrackingId();
            let orderTrackingId = null;

            const [existing] = await pool.execute(
                `SELECT tracking_id, mining_ticket_no FROM order_vehicles WHERE vin = ? LIMIT 1`, [vin]
            );

            if (existing.length) {
                trackingId      = existing[0].tracking_id;
                orderTrackingId = existing[0].tracking_id;

                if (existing[0].mining_ticket_no) {
                    results.push({ vin, mining_ticket_no: existing[0].mining_ticket_no, validation_errors: null });
                    hasSuccesses = true;
                    continue;
                }
            }

            const miningTicketNo = `MIN-TKT-${generateTicketId()}`;

            await pool.execute(
                `INSERT INTO mining_tickets
                 (mining_ticket_no, vin, tracking_id, order_tracking_id, vehicle_details, customer_details, status)
                 VALUES (?,?,?,?,?,?,'pending')`,
                [miningTicketNo, vin, trackingId, orderTrackingId, JSON.stringify(vd), JSON.stringify(cd)]
            );

            if (existing.length) {
                await pool.execute(`UPDATE order_vehicles SET mining_ticket_no=? WHERE vin=?`, [miningTicketNo, vin]);
            }

            results.push({ vin, mining_ticket_no: miningTicketNo, validation_errors: null });
            hasSuccesses = true;
        }

        const statusCode = hasErrors && hasSuccesses ? 206 : hasErrors ? 400 : 200;
        return res.status(statusCode).json({ err: null, data: results });

    } catch (err) {
        console.error('[createMiningRequest] Error:', err);
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

/**
 * POST /api/mining/ticket-status
 * Body: [{ vin_no, mining_ticket_no }]
 */
const getMiningTicketStatus = async (req, res) => {
    try {
        const requests = req.body;

        if (!Array.isArray(requests) || requests.length === 0) {
            return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Request body must be a non-empty array of { vin_no, mining_ticket_no }.' }, data: null });
        }

        const results = [];

        for (const item of requests) {
            const { vin_no, mining_ticket_no } = item;
            if (!vin_no && !mining_ticket_no) {
                results.push({ vin: null, status: null, certificate_file_names: [], error: 'vin_no or mining_ticket_no required' });
                continue;
            }

            let rows;
            if (mining_ticket_no) {
                [rows] = await pool.execute(`SELECT * FROM mining_tickets WHERE mining_ticket_no = ? LIMIT 1`, [mining_ticket_no]);
            } else {
                [rows] = await pool.execute(`SELECT * FROM mining_tickets WHERE vin = ? ORDER BY created_at DESC LIMIT 1`, [vin_no]);
            }

            if (!rows.length) {
                results.push({ vin: vin_no || null, mining_ticket_no: mining_ticket_no || null, status: null, certificate_file_names: [], error: 'Ticket not found' });
                continue;
            }

            const t = rows[0];
            results.push({
                vin:                    t.vin,
                mining_ticket_no:       t.mining_ticket_no,
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
        console.error('[getMiningTicketStatus] Error:', err);
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

module.exports = { createMiningRequest, getMiningTicketStatus };
