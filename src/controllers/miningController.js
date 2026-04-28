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

/** Maps DB status → spec uppercase status */
const mapStatus = (s) => ({
    'pending':                        'PENDING',
    'in_progress':                    'IN_PROGRESS',
    'completed':                      'COMPLETED',
    'on_hold':                        'ON_HOLD',
    'failed':                         'FAILED',
    'cancelled':                      'CANCELLED',
    'cancelled_due_to_change_request':'CANCELLED_DUE_TO_CHANGE_REQUEST',
})[s] || 'PENDING';

/**
 * POST /mining
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
 * POST /mining/ticket-status
 * Body: [{ "vin_no": "...", "mining_ticket_no": "..." }]
 *
 * Response: { "err": null, "data": [{ vin, mining_ticket_no, status, remark, handler,
 *   handler_contact, process_datetime, certification_registration_datetime,
 *   certification_expiry_date, certificate_file_location, certificate_file_names, metadata }] }
 */
const getMiningTicketStatus = async (req, res) => {
    try {
        const requests = req.body;

        if (!Array.isArray(requests) || requests.length === 0) {
            return res.status(400).json({
                err:  { code: 'INVALID_DATA', message: 'Request body must be a non-empty array of { vin_no, mining_ticket_no }.' },
                data: null,
            });
        }

        const results = [];

        for (const item of requests) {
            const { vin_no, mining_ticket_no } = item;

            if (!vin_no && !mining_ticket_no) {
                results.push({
                    vin: null, mining_ticket_no: null, status: null,
                    remark: null, handler: null, handler_contact: null,
                    process_datetime: null, certification_registration_datetime: null,
                    certification_expiry_date: null, certificate_file_location: null,
                    certificate_file_names: [], metadata: {},
                    error: 'vin_no or mining_ticket_no required',
                });
                continue;
            }

            let rows;
            if (mining_ticket_no) {
                [rows] = await pool.execute(
                    `SELECT * FROM mining_tickets WHERE mining_ticket_no = ? LIMIT 1`, [mining_ticket_no]
                );
            } else {
                [rows] = await pool.execute(
                    `SELECT * FROM mining_tickets WHERE vin = ? ORDER BY created_at DESC LIMIT 1`, [vin_no]
                );
            }

            if (!rows.length) {
                results.push({
                    vin: vin_no || null, mining_ticket_no: mining_ticket_no || null,
                    status: null, remark: null, handler: null, handler_contact: null,
                    process_datetime: null, certification_registration_datetime: null,
                    certification_expiry_date: null, certificate_file_location: null,
                    certificate_file_names: [], metadata: {},
                    error: 'Ticket not found',
                });
                continue;
            }

            const t = rows[0];

            const certFileNames = [];
            if (t.certificate_file_name) certFileNames.push(t.certificate_file_name);

            let metadata = {};
            if (t.handler_details) {
                metadata = typeof t.handler_details === 'string'
                    ? JSON.parse(t.handler_details)
                    : t.handler_details;
            }

            results.push({
                vin:                                t.vin,
                mining_ticket_no:                   t.mining_ticket_no,
                status:                             mapStatus(t.status),
                remark:                             t.remark || null,
                handler:                            t.handler || null,
                handler_contact:                    t.handler_contact || null,
                process_datetime:                   t.process_datetime
                    ? new Date(t.process_datetime).toISOString().replace('Z', '')
                    : null,
                certification_registration_datetime: t.certification_registration_datetime
                    ? new Date(t.certification_registration_datetime).toISOString().replace('Z', '')
                    : null,
                certification_expiry_date:          t.certification_expiry_date
                    ? t.certification_expiry_date.toISOString().split('T')[0]
                    : null,
                certificate_file_location:          t.certificate_file_location || t.certificate_file_path || null,
                certificate_file_names:             certFileNames,
                metadata,
            });
        }

        return res.status(200).json({ err: null, data: results });

    } catch (err) {
        console.error('[getMiningTicketStatus] Error:', err);
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

module.exports = { createMiningRequest, getMiningTicketStatus };
