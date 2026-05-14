-- ============================================================
-- TML-OEM-API: Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- Adds missing tables + columns needed by the tml-oem-api backend
-- ============================================================

-- 1. api_clients (stores vendor credentials for token auth)
CREATE TABLE IF NOT EXISTS api_clients (
  id            BIGSERIAL PRIMARY KEY,
  client_id     TEXT NOT NULL UNIQUE,
  client_secret TEXT NOT NULL,
  client_name   TEXT,
  status        INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. token_logs (stores issued JWTs)
CREATE TABLE IF NOT EXISTS token_logs (
  id            BIGSERIAL PRIMARY KEY,
  client_ref_id BIGINT NOT NULL,
  access_token  TEXT NOT NULL,
  token_type    TEXT NOT NULL DEFAULT 'Bearer',
  expires_in    INTEGER NOT NULL DEFAULT 43200,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. spoc_details (SPOC contacts per vehicle tracking ID)
CREATE TABLE IF NOT EXISTS spoc_details (
  id          BIGSERIAL PRIMARY KEY,
  tracking_id TEXT NOT NULL,
  name        TEXT NOT NULL,
  contact_no  TEXT NOT NULL,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add missing columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_ref_id BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS oem_name      TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS device_type   TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_vehicles INTEGER DEFAULT 0;

-- 5. Add missing columns to order_vehicles
ALTER TABLE order_vehicles ADD COLUMN IF NOT EXISTS dispatch_location TEXT;
ALTER TABLE order_vehicles ADD COLUMN IF NOT EXISTS products          JSONB;

-- 6. Seed required api_clients row
INSERT INTO api_clients (client_id, client_secret, client_name, status)
VALUES ('tml-client-id', 'tml-client-secret', 'TML Vendor Integration', 1)
ON CONFLICT (client_id) DO NOTHING;

-- ============================================================
-- Verification
-- ============================================================
SELECT 'api_clients'    AS tbl, count(*) FROM api_clients
UNION ALL
SELECT 'token_logs',      count(*) FROM token_logs
UNION ALL
SELECT 'spoc_details',    count(*) FROM spoc_details
UNION ALL
SELECT 'orders',          count(*) FROM orders
UNION ALL
SELECT 'order_vehicles',  count(*) FROM order_vehicles;
