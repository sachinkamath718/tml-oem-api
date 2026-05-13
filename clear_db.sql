-- ============================================================
-- CLEAR ALL DATA — run each line ONE AT A TIME in Railway
-- Copy one line, run it, then copy the next
-- ============================================================

DELETE FROM mining_tickets;
DELETE FROM ais140_tickets;
DELETE FROM installation_tickets;
DELETE FROM delivery_tickets;
DELETE FROM shipment_tickets;
DELETE FROM order_status_history;
DELETE FROM spoc_details;
DELETE FROM order_vehicles;
DELETE FROM token_logs;
DELETE FROM orders;
DELETE FROM api_clients;
INSERT INTO api_clients (client_id, client_secret, client_name, status) VALUES ('tml-client-id', 'tml-client-secret', 'TML Vendor Integration', 1);
