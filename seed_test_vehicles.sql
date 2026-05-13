-- ============================================================
-- Seed: 3 test vehicles from iTriangle FleetEdge
-- Run this in Supabase SQL Editor → dfewivwmtnmwuikkjdor.supabase.co
-- ============================================================

-- 1. Insert a test order (shared by all 3 vehicles)
INSERT INTO orders (
  order_number, tml_order_id, tracking_id, status, created_by
)
VALUES (
  'WH-ITRIANGLE-TEST-001',
  'WH-ITRIANGLE-TEST-001',
  'TRK-1778594367038-6435A639',
  'pending',
  'itriangle-webhook'
)
ON CONFLICT (order_number) DO NOTHING;

-- Get the order id for FK references
DO $$
DECLARE
  v_order_id BIGINT;
BEGIN
  SELECT id INTO v_order_id FROM orders WHERE order_number = 'WH-ITRIANGLE-TEST-001' LIMIT 1;

  -- ── 2. Order Vehicles ───────────────────────────────────────

  INSERT INTO order_vehicles (order_id, vin, tracking_id, ticket_id, status, ais140_ticket_no, mining_ticket_no)
  VALUES
    (v_order_id, 'MAT800313N8H16571', 'TRK-1778594367038-6435A639', 'TKT-TRK-1778594367038-6435A639', 'pending',
     'AIS-TRK-1778594367038-6435A639', 'MIN-TRK-1778594367038-6435A639'),
    (v_order_id, 'MAT800313N8H16572', 'TRK-1778595514787-5D91DE01', 'TKT-TRK-1778595514787-5D91DE01', 'pending',
     'AIS-TRK-1778595514787-5D91DE01', 'MIN-TRK-1778595514787-5D91DE01'),
    (v_order_id, 'MAT800313N8H16573', 'TRK-1778596418166-90CD9AB7', 'TKT-TRK-1778596418166-90CD9AB7', 'pending',
     'AIS-TRK-1778596418166-90CD9AB7', 'MIN-TRK-1778596418166-90CD9AB7')
  ON CONFLICT (vin) DO NOTHING;

  -- ── 3. Shipment Tickets (Pending) ──────────────────────────
  INSERT INTO shipment_tickets (ticket_no, vin, tracking_id, order_id, status)
  VALUES
    ('TKT-TRK-1778594367038-6435A639', 'MAT800313N8H16571', 'TRK-1778594367038-6435A639', v_order_id, 'pending'),
    ('TKT-TRK-1778595514787-5D91DE01', 'MAT800313N8H16572', 'TRK-1778595514787-5D91DE01', v_order_id, 'pending'),
    ('TKT-TRK-1778596418166-90CD9AB7', 'MAT800313N8H16573', 'TRK-1778596418166-90CD9AB7', v_order_id, 'pending')
  ON CONFLICT (ticket_no) DO NOTHING;

  -- ── 4. Delivery Tickets (Pending) ──────────────────────────
  INSERT INTO delivery_tickets (ticket_no, vin, tracking_id, order_id, status)
  VALUES
    ('TKT-TRK-1778594367038-6435A639', 'MAT800313N8H16571', 'TRK-1778594367038-6435A639', v_order_id, 'pending'),
    ('TKT-TRK-1778595514787-5D91DE01', 'MAT800313N8H16572', 'TRK-1778595514787-5D91DE01', v_order_id, 'pending'),
    ('TKT-TRK-1778596418166-90CD9AB7', 'MAT800313N8H16573', 'TRK-1778596418166-90CD9AB7', v_order_id, 'pending')
  ON CONFLICT (ticket_no) DO NOTHING;

  -- ── 5. Installation Tickets (Pending) ──────────────────────
  INSERT INTO installation_tickets (ticket_no, vin, tracking_id, order_id, status)
  VALUES
    ('INS-TRK-1778594367038-6435A639', 'MAT800313N8H16571', 'TRK-1778594367038-6435A639', v_order_id, 'pending'),
    ('INS-TRK-1778595514787-5D91DE01', 'MAT800313N8H16572', 'TRK-1778595514787-5D91DE01', v_order_id, 'pending'),
    ('INS-TRK-1778596418166-90CD9AB7', 'MAT800313N8H16573', 'TRK-1778596418166-90CD9AB7', v_order_id, 'pending')
  ON CONFLICT (ticket_no) DO NOTHING;

  -- ── 6. AIS140 Tickets (Pending) ────────────────────────────
  INSERT INTO ais140_tickets (ticket_no, vin, tracking_id, order_tracking_id, status)
  VALUES
    ('AIS-TRK-1778594367038-6435A639', 'MAT800313N8H16571', 'TRK-1778594367038-6435A639', 'TRK-1778594367038-6435A639', 'pending'),
    ('AIS-TRK-1778595514787-5D91DE01', 'MAT800313N8H16572', 'TRK-1778595514787-5D91DE01', 'TRK-1778595514787-5D91DE01', 'pending'),
    ('AIS-TRK-1778596418166-90CD9AB7', 'MAT800313N8H16573', 'TRK-1778596418166-90CD9AB7', 'TRK-1778596418166-90CD9AB7', 'pending')
  ON CONFLICT (ticket_no) DO NOTHING;

  -- ── 7. Mining Tickets (Pending) ────────────────────────────
  INSERT INTO mining_tickets (mining_ticket_no, vin, tracking_id, order_tracking_id, status)
  VALUES
    ('MIN-TRK-1778594367038-6435A639', 'MAT800313N8H16571', 'TRK-1778594367038-6435A639', 'TRK-1778594367038-6435A639', 'pending'),
    ('MIN-TRK-1778595514787-5D91DE01', 'MAT800313N8H16572', 'TRK-1778595514787-5D91DE01', 'TRK-1778595514787-5D91DE01', 'pending'),
    ('MIN-TRK-1778596418166-90CD9AB7', 'MAT800313N8H16573', 'TRK-1778596418166-90CD9AB7', 'TRK-1778596418166-90CD9AB7', 'pending')
  ON CONFLICT (mining_ticket_no) DO NOTHING;

END $$;
