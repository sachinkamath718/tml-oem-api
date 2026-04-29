-- Migration: Add new columns to existing tables (safe, skips if exists)

-- Add to orders table
SET @dbname = DATABASE();

-- tml_order_id
SET @col = 'tml_order_id';
SET @tbl = 'orders';
SET @sql = IF(
  NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),
  CONCAT('ALTER TABLE orders ADD COLUMN tml_order_id VARCHAR(100) NULL AFTER order_number'),
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- device_type
SET @col = 'device_type';
SET @sql = IF(
  NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),
  'ALTER TABLE orders ADD COLUMN device_type VARCHAR(100) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- customer_details
SET @col = 'customer_details';
SET @sql = IF(
  NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),
  'ALTER TABLE orders ADD COLUMN customer_details JSON NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- order_vehicles new columns
SET @tbl = 'order_vehicles';

SET @col = 'registration_no';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN registration_no VARCHAR(100) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'engine_no';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN engine_no VARCHAR(100) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'model';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN model VARCHAR(255) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'make';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN make VARCHAR(255) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'variant';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN variant VARCHAR(255) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'mfg_year';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN mfg_year VARCHAR(10) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'fuel_type';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN fuel_type VARCHAR(50) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'emission_type';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN emission_type VARCHAR(50) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'rto_office_code';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN rto_office_code VARCHAR(50) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'rto_state';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN rto_state VARCHAR(50) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'iccid';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN iccid VARCHAR(100) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'device_imei';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN device_imei VARCHAR(100) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'device_make';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN device_make VARCHAR(100) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'device_model';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN device_model VARCHAR(100) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'products';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN products JSON NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'ais140_ticket_no';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN ais140_ticket_no VARCHAR(100) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'mining_ticket_no';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE order_vehicles ADD COLUMN mining_ticket_no VARCHAR(100) NULL','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- New tables
CREATE TABLE IF NOT EXISTS spoc_details (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  tracking_id VARCHAR(100) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  contact_no  VARCHAR(50)  NOT NULL,
  email       VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tracking_id (tracking_id)
);

CREATE TABLE IF NOT EXISTS ais140_tickets (
  id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_no             VARCHAR(100) NOT NULL UNIQUE,
  vin                   VARCHAR(100) NOT NULL,
  tracking_id           VARCHAR(100) NOT NULL,
  order_tracking_id     VARCHAR(100) NULL,
  vehicle_details       JSON NULL,
  customer_details      JSON NULL,
  status                ENUM('pending','in_progress','completed','on_hold','failed') DEFAULT 'pending',
  handler_details       JSON NULL,
  certificate_file_name VARCHAR(500) NULL,
  certificate_file_path VARCHAR(1000) NULL,
  validation_errors     JSON NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vin (vin),
  INDEX idx_tracking_id (tracking_id)
);

CREATE TABLE IF NOT EXISTS mining_tickets (
  id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
  mining_ticket_no      VARCHAR(100) NOT NULL UNIQUE,
  vin                   VARCHAR(100) NOT NULL,
  tracking_id           VARCHAR(100) NOT NULL,
  order_tracking_id     VARCHAR(100) NULL,
  vehicle_details       JSON NULL,
  customer_details      JSON NULL,
  status                ENUM('pending','in_progress','completed','on_hold','failed') DEFAULT 'pending',
  handler_details       JSON NULL,
  certificate_file_name VARCHAR(500) NULL,
  certificate_file_path VARCHAR(1000) NULL,
  validation_errors     JSON NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vin (vin),
  INDEX idx_tracking_id (tracking_id)
);

-- ============================================================
-- Migration: Add missing handler/status/certification columns
-- Safe to run on existing Railway DB — skips if column exists
-- ============================================================

-- ais140_tickets: handler/status fields
SET @tbl = 'ais140_tickets';

SET @col = 'remark';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE ais140_tickets ADD COLUMN remark TEXT NULL COMMENT ''Status remark or notes'' AFTER handler_details','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'handler';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE ais140_tickets ADD COLUMN handler VARCHAR(255) NULL COMMENT ''Assigned handler name'' AFTER remark','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'handler_contact';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE ais140_tickets ADD COLUMN handler_contact VARCHAR(100) NULL COMMENT ''Handler phone/email'' AFTER handler','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'process_datetime';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE ais140_tickets ADD COLUMN process_datetime DATETIME NULL COMMENT ''When ticket was processed'' AFTER handler_contact','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ais140_tickets: AIS140-specific certification fields
SET @col = 'certification_registration_datetime';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE ais140_tickets ADD COLUMN certification_registration_datetime DATETIME NULL COMMENT ''When certificate was registered'' AFTER process_datetime','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'certification_expiry_date';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE ais140_tickets ADD COLUMN certification_expiry_date DATE NULL COMMENT ''Certificate expiry date'' AFTER certification_registration_datetime','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'certificate_file_location';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE ais140_tickets ADD COLUMN certificate_file_location VARCHAR(1000) NULL COMMENT ''Public URL / S3 URL of certificate'' AFTER certification_expiry_date','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- mining_tickets: handler/status fields
SET @tbl = 'mining_tickets';

SET @col = 'remark';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE mining_tickets ADD COLUMN remark TEXT NULL COMMENT ''Status remark or notes'' AFTER handler_details','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'handler';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE mining_tickets ADD COLUMN handler VARCHAR(255) NULL COMMENT ''Assigned handler name'' AFTER remark','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'handler_contact';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE mining_tickets ADD COLUMN handler_contact VARCHAR(100) NULL COMMENT ''Handler phone/email'' AFTER handler','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'process_datetime';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE mining_tickets ADD COLUMN process_datetime DATETIME NULL COMMENT ''When ticket was processed'' AFTER handler_contact','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col = 'polling_datetime';
SET @sql = IF(NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),'ALTER TABLE mining_tickets ADD COLUMN polling_datetime DATETIME NULL COMMENT ''Last polling timestamp'' AFTER process_datetime','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- Add UNIQUE constraints to order_vehicles (safe, skips if exists)
-- ============================================================
SET @tbl = 'order_vehicles';

SET @idx = 'uq_order_vehicles_tracking_id';
SET @sql = IF(
  NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND INDEX_NAME=@idx),
  'ALTER TABLE order_vehicles ADD UNIQUE INDEX uq_order_vehicles_tracking_id (tracking_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx = 'uq_order_vehicles_ais140_ticket_no';
SET @sql = IF(
  NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND INDEX_NAME=@idx),
  'ALTER TABLE order_vehicles ADD UNIQUE INDEX uq_order_vehicles_ais140_ticket_no (ais140_ticket_no)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx = 'uq_order_vehicles_mining_ticket_no';
SET @sql = IF(
  NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@dbname AND TABLE_NAME=@tbl AND INDEX_NAME=@idx),
  'ALTER TABLE order_vehicles ADD UNIQUE INDEX uq_order_vehicles_mining_ticket_no (mining_ticket_no)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SHOW TABLES;

