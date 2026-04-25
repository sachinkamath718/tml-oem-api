const pool = require('../config/db');
const { generateOrderNumber, generateTrackingId, generateTicketId } = require('../utils/idGenerator');

/**
 * POST /api/orders/create
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Request Body:
 * {
 *   "oem_name": "Tata Motors",
 *   "vehicles": [
 *     { "vin": "VIN001", "dispatch_location": "Mumbai Warehouse" },
 *     { "vin": "VIN002", "dispatch_location": "Delhi Hub" },
 *     { "vin": "VIN003", "dispatch_location": "Mumbai Warehouse" }
 *   ]
 * }
 *
 * Rules:
 * - One order = one tracking_id shared across Shipment, Delivery, Installation
 * - One VIN = one unique ticket_id
 * - Multiple dispatch locations allowed within the same order
 */
async function createOrder(req, res) {
    const { oem_name, vehicles } = req.body;
    const { client_ref_id, client_id } = req.client; // from JWT middleware

    // --- Validate input ---
    if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
        return res.status(400).json({
            success: false,
            message: '`vehicles` array is required and must contain at least one vehicle.',
        });
    }

    // Check for duplicate VINs in request
    const vins = vehicles.map(v => v.vin);
    const uniqueVins = new Set(vins);
    if (uniqueVins.size !== vins.length) {
        return res.status(400).json({
            success: false,
            message: 'Duplicate VINs found in the request. Each vehicle must have a unique VIN.',
        });
    }

    // Check VINs not already in DB
    const [existingVins] = await pool.query(
        `SELECT vin FROM order_vehicles WHERE vin IN (${vins.map(() => '?').join(',')})`,
        vins
    );
    if (existingVins.length > 0) {
        return res.status(409).json({
            success: false,
            message: `VINs already registered: ${existingVins.map(r => r.vin).join(', ')}`,
        });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // --- Generate IDs ---
        const order_number = generateOrderNumber();
        const tracking_id  = generateTrackingId(); // Shared across modules: Orders, Shipment, Delivery, Installation

        // --- Insert order ---
        const [orderResult] = await conn.query(
            `INSERT INTO orders
               (order_number, tracking_id, client_ref_id, oem_name, total_vehicles, status, created_by)
             VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
            [order_number, tracking_id, client_ref_id, oem_name || null, vehicles.length, client_id]
        );
        const order_id = orderResult.insertId;

        // --- Create one ticket per VIN ---
        const tickets = [];
        for (const vehicle of vehicles) {
            const ticket_id = generateTicketId();

            await conn.query(
                `INSERT INTO order_vehicles
                   (order_id, vin, ticket_id, tracking_id, dispatch_location, status)
                 VALUES (?, ?, ?, ?, ?, 'pending')`,
                [order_id, vehicle.vin, ticket_id, tracking_id, vehicle.dispatch_location || null]
            );

            tickets.push({
                vin:               vehicle.vin,
                ticket_id,
                tracking_id,
                dispatch_location: vehicle.dispatch_location || null,
                status:            'pending',
            });
        }

        // --- Record initial status history ---
        await conn.query(
            `INSERT INTO order_status_history
               (order_id, vin, from_status, to_status, changed_by, notes, metadata)
             VALUES (?, NULL, NULL, 'pending', ?, 'Order created', ?)`,
            [
                order_id,
                client_id,
                JSON.stringify({
                    event:      'order_created',
                    timestamp:  new Date().toISOString(),
                    total_vins: vehicles.length,
                }),
            ]
        );

        await conn.commit();

        return res.status(201).json({
            success: true,
            message: 'Order created successfully.',
            data: {
                order_id,
                order_number,
                tracking_id,
                oem_name:        oem_name || null,
                total_vehicles:  vehicles.length,
                status:          'pending',
                tickets,
                note: 'tracking_id is shared across Shipment, Delivery, and Installation modules.',
            },
        });

    } catch (err) {
        await conn.rollback();
        console.error('[createOrder] Error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    } finally {
        conn.release();
    }
}

module.exports = { createOrder };
