const pool = require('../config/db');
const { generateTrackingId, generateTicketId, generateOrderNumber } = require('../utils/idGenerator');

/**
 * POST /api/orders/create
 */
const createOrder = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { order_id, device_type, customer_details, location_mappings } = req.body;
        const clientId    = req.client.client_id;
        const clientRefId = req.client.client_ref_id;

        // ── Validate ──────────────────────────────────────────────
        if (!order_id) {
            return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'order_id is required.' }, data: null });
        }
        if (!customer_details?.name) {
            return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'customer_details.name is required.' }, data: null });
        }
        if (!Array.isArray(location_mappings) || location_mappings.length === 0) {
            return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'location_mappings must be a non-empty array.' }, data: null });
        }

        // ── Flatten vehicles ──────────────────────────────────────
        const allVehicles = [];
        for (const mapping of location_mappings) {
            const { location, spoc, vehicle_details } = mapping;
            if (!Array.isArray(vehicle_details) || vehicle_details.length === 0) {
                return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'vehicle_details must be a non-empty array in each location_mapping.' }, data: null });
            }
            for (const v of vehicle_details) {
                if (!v.vin)       return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Each vehicle must have a vin.' }, data: null });
                if (!v.engine_no) return res.status(400).json({ err: { code: 'INVALID_DATA', message: `engine_no is required for VIN ${v.vin}.` }, data: null });
                allVehicles.push({ ...v, location, spoc });
            }
        }

        const orderNumber    = generateOrderNumber();
        const trackingId     = generateTrackingId();   // single tracking_id for entire order
        const orderCreatedAt = new Date().toISOString();

        await conn.beginTransaction();

        // ── Insert order ──────────────────────────────────────────
        const [orderResult] = await conn.execute(
            `INSERT INTO orders
             (order_number, tml_order_id, tracking_id, client_ref_id, oem_name, device_type,
              total_vehicles, status, customer_details, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
            [
                orderNumber, order_id, trackingId, clientRefId,
                customer_details.name, device_type || null,
                allVehicles.length,
                JSON.stringify(customer_details),
                clientId,
            ]
        );
        const orderId = orderResult.insertId;

        // ── Per-vehicle processing ────────────────────────────────
        const tickets = [];

        for (const vehicle of allVehicles) {
            const ticketId       = generateTicketId();
            const sharedTicketNo = `TKT-${ticketId}`;   // ONE ticket number shared by order, AIS140, Mining
            const hasAIS140      = (vehicle.products || []).some(p => p.name === 'AIS140');
            const hasMINING      = (vehicle.products || []).some(p => p.name === 'MINING');
            const ais140TicketNo = hasAIS140 ? sharedTicketNo : null;
            const miningTicketNo = hasMINING  ? sharedTicketNo : null;


            // Insert into order_vehicles
            await conn.execute(
                `INSERT INTO order_vehicles
                 (order_id, vin, ticket_id, tracking_id, dispatch_location,
                  registration_no, engine_no, model, make, variant, mfg_year,
                  fuel_type, emission_type, rto_office_code, rto_state,
                  products, ais140_ticket_no, mining_ticket_no, status)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`,
                [
                    orderId, vehicle.vin, ticketId, trackingId,
                    vehicle.location?.address || vehicle.location?.city || null,
                    vehicle.registration_no || null,
                    vehicle.engine_no       || null,
                    vehicle.model           || null,
                    vehicle.make            || null,
                    vehicle.variant         || null,
                    vehicle.mfg_year        || null,
                    vehicle.fuel_type       || null,
                    vehicle.emission_type   || null,
                    vehicle.rto_office_code || null,
                    vehicle.rto_state       || null,
                    JSON.stringify(vehicle.products || []),
                    ais140TicketNo,
                    miningTicketNo,
                ]
            );

            // ── Shipment ticket (always created) ──────────────────
            await conn.execute(
                `INSERT INTO shipment_tickets (ticket_no, vin, tracking_id, order_id, status)
                 VALUES (?,?,?,?,'pending')`,
                [sharedTicketNo, vehicle.vin, trackingId, orderId]
            );

            // ── Delivery ticket (always created) ───────────────────
            await conn.execute(
                `INSERT INTO delivery_tickets (ticket_no, vin, tracking_id, order_id, status, delivery_address)
                 VALUES (?,?,?,?,'pending',?)`,
                [sharedTicketNo, vehicle.vin, trackingId, orderId,
                 vehicle.location?.address || null]
            );

            // ── Installation ticket (always created) ───────────────
            await conn.execute(
                `INSERT INTO installation_tickets (ticket_no, vin, tracking_id, order_id, status)
                 VALUES (?,?,?,?,'pending')`,
                [sharedTicketNo, vehicle.vin, trackingId, orderId]
            );

            // ── If AIS140 product → create ticket in ais140_tickets table ──

            if (hasAIS140) {
                const ais140Product = vehicle.products.find(p => p.name === 'AIS140');
                await conn.execute(
                    `INSERT INTO ais140_tickets
                     (ticket_no, vin, tracking_id, order_tracking_id, vehicle_details, customer_details, status)
                     VALUES (?,?,?,?,?,?,'pending')`,
                    [
                        ais140TicketNo, vehicle.vin, trackingId, trackingId,
                        JSON.stringify({
                            vin: vehicle.vin, engine_no: vehicle.engine_no,
                            reg_number: vehicle.registration_no, vehicle_model: vehicle.model,
                            make: vehicle.make, mfg_year: vehicle.mfg_year,
                            fuel_type: vehicle.fuel_type, emission_type: vehicle.emission_type,
                            rto_office_code: vehicle.rto_office_code, rto_state: vehicle.rto_state,
                            certificate_validity_duration_in_year: ais140Product?.duration_in_years || 2,
                        }),
                        JSON.stringify(customer_details),
                    ]
                );
            }

            // ── If MINING product → create ticket in mining_tickets table ──
            if (hasMINING) {
                const miningProduct = vehicle.products.find(p => p.name === 'MINING');
                await conn.execute(
                    `INSERT INTO mining_tickets
                     (mining_ticket_no, vin, tracking_id, order_tracking_id, vehicle_details, customer_details, status)
                     VALUES (?,?,?,?,?,?,'pending')`,
                    [
                        miningTicketNo, vehicle.vin, trackingId, trackingId,
                        JSON.stringify({
                            vin: vehicle.vin, engine_no: vehicle.engine_no,
                            reg_number: vehicle.registration_no, vehicle_model: vehicle.model,
                            make: vehicle.make, mfg_year: vehicle.mfg_year,
                            department: miningProduct?.metadata?.department || null,
                            duration_in_year: miningProduct?.duration_in_years || 2,
                            rto_office_code: vehicle.rto_office_code, rto_state: vehicle.rto_state,
                        }),
                        JSON.stringify(customer_details),
                    ]
                );
            }

            // ── Save SPOC ──────────────────────────────────────────
            if (vehicle.spoc?.name) {
                await conn.execute(
                    `INSERT INTO spoc_details (tracking_id, name, contact_no, email) VALUES (?,?,?,?)`,
                    [trackingId, vehicle.spoc.name, vehicle.spoc.contact_number || '', vehicle.spoc.email || '']
                );
            }

            tickets.push({
                vin:               vehicle.vin,
                order_tracking_id: trackingId,
                ais140_ticket_no:  ais140TicketNo,
                mining_ticket_no:  miningTicketNo,
            });
        }

        // ── Audit log ─────────────────────────────────────────────
        await conn.execute(
            `INSERT INTO order_status_history (order_id, stage, to_status, changed_by, notes, metadata)
             VALUES (?, 'ORDER_CREATED', 'pending', ?, 'Order created', ?)`,
            [orderId, clientId, JSON.stringify({ event: 'order_created', timestamp: orderCreatedAt, total_vins: allVehicles.length })]
        );

        await conn.commit();

        return res.status(200).json({ err: null, data: tickets });

    } catch (err) {
        await conn.rollback();
        console.error('[createOrder] Error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ err: { code: 'DUPLICATE_VIN', message: 'One or more VINs already exist in the system.' }, data: null });
        }
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    } finally {
        conn.release();
    }
};

module.exports = { createOrder };
