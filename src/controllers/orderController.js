const pool = require('../config/db');
const { generateTrackingId, generateTicketId, generateOrderNumber, nowIST } = require('../utils/idGenerator');

/**
 * POST /orders/create
 *
 * ID Design (fixed):
 *   orderTrackingId   — one per order   (orders.tracking_id)
 *   vehicleTrackingId — one per vehicle  (order_vehicles.tracking_id)
 *   ticketNo          — one per vehicle  (TKT-XXXX) for shipment/delivery/install
 *   ais140TicketNo    — per vehicle      (AIS-TKT-XXXX), unique in ais140_tickets
 *   miningTicketNo    — per vehicle      (MIN-TKT-XXXX), unique in mining_tickets
 */
const createOrder = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { order_id, device_type, customer_details, location_mappings } = req.body;
        const clientId    = req.client.client_id;
        const clientRefId = req.client.client_ref_id;

        // ── Validate top-level fields ──────────────────────────────
        if (!order_id || !customer_details || !Array.isArray(location_mappings) || location_mappings.length === 0) {
            return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Invalid vehicle details provided' }, data: null });
        }
        if (!customer_details.name || !customer_details.email || !customer_details.contact_number) {
            return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Invalid vehicle details provided' }, data: null });
        }

        // ── Flatten + validate vehicles ────────────────────────────
        const allVehicles = [];
        const vinSet      = new Set();
        for (const mapping of location_mappings) {
            const { location, spoc, vehicle_details } = mapping;
            if (!Array.isArray(vehicle_details) || vehicle_details.length === 0) {
                return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Invalid vehicle details provided' }, data: null });
            }
            for (const v of vehicle_details) {
                if (!v.vin || !v.registration_no || !v.engine_no || !v.model ||
                    !v.make || !v.mfg_year || !v.fuel_type || !v.emission_type ||
                    !v.rto_office_code || !v.rto_state) {
                    return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Invalid vehicle details provided' }, data: null });
                }
                if (vinSet.has(v.vin)) {
                    return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Invalid vehicle details provided' }, data: null });
                }
                vinSet.add(v.vin);
                allVehicles.push({ ...v, location, spoc });
            }
        }

        const orderNumber     = generateOrderNumber();
        const orderTrackingId = generateTrackingId(); // order-level, stays same for all vehicles
        const createdAtIST    = nowIST();

        await conn.beginTransaction();

        // ── Insert order ───────────────────────────────────────────
        const [orderResult] = await conn.execute(
            `INSERT INTO orders
             (order_number, tml_order_id, tracking_id, client_ref_id, oem_name, device_type,
              total_vehicles, status, customer_details, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
            [
                orderNumber, order_id, orderTrackingId, clientRefId,
                customer_details.name, device_type || null,
                allVehicles.length,
                JSON.stringify(customer_details),
                clientId,
            ]
        );
        const orderId = orderResult.insertId;

        // ── Order-level audit log ──────────────────────────────────
        await conn.execute(
            `INSERT INTO order_status_history (order_id, stage, to_status, changed_by, notes, metadata)
             VALUES (?, 'ORDER_CREATED', 'pending', ?, 'Order created', ?)`,
            [orderId, clientId, JSON.stringify({
                event:             'order_created',
                timestamp_ist:     createdAtIST,
                total_vins:        allVehicles.length,
                order_tracking_id: orderTrackingId,
            })]
        );

        const tickets = [];

        // ── Per-vehicle processing ─────────────────────────────────
        for (const vehicle of allVehicles) {
            // Every vehicle gets its OWN unique tracking ID
            // tracking_id = ais140_ticket_no = mining_ticket_no (all same per vehicle)
            const vehicleTrackingId = generateTrackingId();               // unique per vehicle
            const ticketNo          = `TKT-${generateTicketId()}`;        // shipment/delivery/install
            const hasAIS140         = (vehicle.products || []).some(p => p.name === 'AIS140');
            const hasMINING         = (vehicle.products || []).some(p => p.name === 'MINING');
            const ais140TicketNo    = hasAIS140 ? vehicleTrackingId : null;  // same as tracking_id
            const miningTicketNo    = hasMINING  ? vehicleTrackingId : null; // same as tracking_id

            // order_vehicles
            await conn.execute(
                `INSERT INTO order_vehicles
                 (order_id, vin, ticket_id, tracking_id, dispatch_location,
                  registration_no, engine_no, model, make, variant, mfg_year,
                  fuel_type, emission_type, rto_office_code, rto_state,
                  products, ais140_ticket_no, mining_ticket_no, status)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`,
                [
                    orderId, vehicle.vin, ticketNo, vehicleTrackingId,
                    vehicle.location?.address || vehicle.location?.city || null,
                    vehicle.registration_no, vehicle.engine_no, vehicle.model,
                    vehicle.make, vehicle.variant || null, vehicle.mfg_year,
                    vehicle.fuel_type, vehicle.emission_type,
                    vehicle.rto_office_code, vehicle.rto_state,
                    JSON.stringify(vehicle.products || []),
                    ais140TicketNo, miningTicketNo,
                ]
            );

            // Shipment ticket
            await conn.execute(
                `INSERT INTO shipment_tickets (ticket_no, vin, tracking_id, order_id, status) VALUES (?,?,?,?,'pending')`,
                [ticketNo, vehicle.vin, vehicleTrackingId, orderId]
            );

            // Delivery ticket
            await conn.execute(
                `INSERT INTO delivery_tickets (ticket_no, vin, tracking_id, order_id, status, delivery_address) VALUES (?,?,?,?,'pending',?)`,
                [ticketNo, vehicle.vin, vehicleTrackingId, orderId, vehicle.location?.address || null]
            );

            // Installation ticket
            await conn.execute(
                `INSERT INTO installation_tickets (ticket_no, vin, tracking_id, order_id, status) VALUES (?,?,?,?,'pending')`,
                [ticketNo, vehicle.vin, vehicleTrackingId, orderId]
            );

            // AIS140 ticket (unique ticket_no per vehicle)
            if (hasAIS140) {
                const ais140Product = vehicle.products.find(p => p.name === 'AIS140');
                await conn.execute(
                    `INSERT INTO ais140_tickets
                     (ticket_no, vin, tracking_id, order_tracking_id, vehicle_details, customer_details, status)
                     VALUES (?,?,?,?,?,?,'pending')`,
                    [
                        ais140TicketNo, vehicle.vin, vehicleTrackingId, orderTrackingId,
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

            // Mining ticket (unique ticket_no per vehicle)
            if (hasMINING) {
                const miningProduct = vehicle.products.find(p => p.name === 'MINING');
                await conn.execute(
                    `INSERT INTO mining_tickets
                     (mining_ticket_no, vin, tracking_id, order_tracking_id, vehicle_details, customer_details, status)
                     VALUES (?,?,?,?,?,?,'pending')`,
                    [
                        miningTicketNo, vehicle.vin, vehicleTrackingId, orderTrackingId,
                        JSON.stringify({
                            vin: vehicle.vin, engine_no: vehicle.engine_no,
                            reg_number: vehicle.registration_no, vehicle_model: vehicle.model,
                            make: vehicle.make, mfg_year: vehicle.mfg_year,
                            department: miningProduct?.metadata?.department || null,
                            duration_in_year: miningProduct?.duration_in_years || 2,
                        }),
                        JSON.stringify(customer_details),
                    ]
                );
            }

            // SPOC (per vehicle tracking ID)
            if (vehicle.spoc?.name) {
                await conn.execute(
                    `INSERT INTO spoc_details (tracking_id, name, contact_no, email) VALUES (?,?,?,?)`,
                    [vehicleTrackingId, vehicle.spoc.name, vehicle.spoc.contact_number || '', vehicle.spoc.email || '']
                );
            }

            // Per-vehicle status history entry
            await conn.execute(
                `INSERT INTO order_status_history (order_id, vin, stage, to_status, changed_by, notes, metadata)
                 VALUES (?, ?, 'ORDER_CREATED', 'pending', ?, 'Vehicle registered in order', ?)`,
                [orderId, vehicle.vin, clientId, JSON.stringify({
                    timestamp_ist:      createdAtIST,
                    vehicle_tracking_id: vehicleTrackingId,
                    ticket_no:          ticketNo,
                    ais140_ticket_no:   ais140TicketNo,
                    mining_ticket_no:   miningTicketNo,
                })]
            );

            tickets.push({
                vin:               vehicle.vin,
                order_tracking_id: orderTrackingId,     // order-level (same for all vehicles)
                tracking_id:       vehicleTrackingId,   // vehicle-level (unique per vehicle) — use this for status lookup
                ais140_ticket_no:  ais140TicketNo,
                mining_ticket_no:  miningTicketNo,
            });
        }

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
