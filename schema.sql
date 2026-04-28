-- ============================================================
-- TML OEM Integration API — Full MySQL Schema v3
-- Tables: 11
-- Last Updated: April 2026
-- ============================================================

-- 1. API Clients (vendor credentials)
CREATE TABLE IF NOT EXISTS api_clients (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    client_id     VARCHAR(150) NOT NULL UNIQUE,
    client_secret VARCHAR(255) NOT NULL,
    client_name   VARCHAR(255) NULL,
    status        TINYINT NOT NULL DEFAULT 1 COMMENT '1=Active, 0=Inactive',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Token Logs
CREATE TABLE IF NOT EXISTS token_logs (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    client_ref_id BIGINT NOT NULL,
    access_token  TEXT NOT NULL,
    token_type    VARCHAR(50) NOT NULL DEFAULT 'Bearer',
    expires_in    INT NOT NULL DEFAULT 43200,
    expires_at    DATETIME NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_ref_id) REFERENCES api_clients(id) ON DELETE CASCADE
);

-- 3. Orders
CREATE TABLE IF NOT EXISTS orders (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_number     VARCHAR(100) NOT NULL UNIQUE,
    tml_order_id     VARCHAR(100) NULL COMMENT 'Order ID from TML system',
    tracking_id      VARCHAR(100) NOT NULL COMMENT 'Shared tracking ID across all modules',
    client_ref_id    BIGINT NOT NULL,
    oem_name         VARCHAR(255) NULL,
    device_type      VARCHAR(100) NULL,
    total_vehicles   INT DEFAULT 0,
    status           ENUM('pending','in_progress','completed','on_hold','failed') DEFAULT 'pending',
    customer_details JSON NULL COMMENT 'name, pan, gst, email, contact_number',
    created_by       VARCHAR(255) NULL,
    metadata         JSON NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_ref_id) REFERENCES api_clients(id)
);

-- 4. Order Vehicles / Order Tickets (1 VIN = 1 Ticket)
CREATE TABLE IF NOT EXISTS order_vehicles (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id          BIGINT NOT NULL,
    vin               VARCHAR(100) NOT NULL UNIQUE,
    ticket_id         VARCHAR(100) NOT NULL UNIQUE COMMENT 'Shared TKT-XXXX across all module tickets',
    tracking_id       VARCHAR(100) NOT NULL,
    dispatch_location VARCHAR(500) NULL,
    -- Vehicle details
    registration_no   VARCHAR(100) NULL,
    engine_no         VARCHAR(100) NULL,
    model             VARCHAR(255) NULL,
    make              VARCHAR(255) NULL,
    variant           VARCHAR(255) NULL,
    mfg_year          VARCHAR(10)  NULL,
    fuel_type         VARCHAR(50)  NULL,
    emission_type     VARCHAR(50)  NULL,
    rto_office_code   VARCHAR(50)  NULL,
    rto_state         VARCHAR(50)  NULL,
    -- Device details (filled post-fitment)
    iccid             VARCHAR(100) NULL,
    device_imei       VARCHAR(100) NULL,
    device_make       VARCHAR(100) NULL,
    device_model      VARCHAR(100) NULL,
    -- Products & linked tickets
    products          JSON NULL COMMENT 'Array: AIS140, MINING, FLEET_TRACK, PANIC_BUTTON, IMMOBILIZER',
    ais140_ticket_no  VARCHAR(100) NULL,
    mining_ticket_no  VARCHAR(100) NULL,
    status            ENUM('pending','in_progress','completed','on_hold','failed') DEFAULT 'pending',
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 5. SPOC Details
CREATE TABLE IF NOT EXISTS spoc_details (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    tracking_id  VARCHAR(100) NOT NULL,
    name         VARCHAR(255) NOT NULL,
    contact_no   VARCHAR(50)  NOT NULL,
    email        VARCHAR(255) NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tracking_id (tracking_id)
);

-- 6. Order Status History (Audit Trail)
CREATE TABLE IF NOT EXISTS order_status_history (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id    BIGINT NOT NULL,
    vin         VARCHAR(100) NULL COMMENT 'NULL = order-level event',
    stage       VARCHAR(100) NULL COMMENT 'ORDER_CREATED | TCU_SHIPPED | TCU_DELIVERED | DEVICE_INSTALLED',
    from_status VARCHAR(50)  NULL,
    to_status   VARCHAR(50)  NOT NULL,
    changed_by  VARCHAR(255) NULL,
    notes       TEXT         NULL,
    metadata    JSON         NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 7. Shipment Tickets
CREATE TABLE IF NOT EXISTS shipment_tickets (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_no         VARCHAR(100) NOT NULL COMMENT 'Same TKT-XXXX as order_vehicles.ticket_id',
    vin               VARCHAR(100) NOT NULL,
    tracking_id       VARCHAR(100) NOT NULL,
    order_id          BIGINT NOT NULL,
    status            ENUM('pending','in_progress','completed','on_hold','failed') DEFAULT 'pending',
    courier           VARCHAR(255) NULL,
    awb_number        VARCHAR(255) NULL COMMENT 'Air Waybill / courier tracking number',
    expected_delivery DATE NULL,
    dispatched_at     TIMESTAMP NULL,
    metadata          JSON NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vin (vin),
    INDEX idx_tracking_id (tracking_id)
);

-- 8. Delivery Tickets
CREATE TABLE IF NOT EXISTS delivery_tickets (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_no        VARCHAR(100) NOT NULL COMMENT 'Same TKT-XXXX as order_vehicles.ticket_id',
    vin              VARCHAR(100) NOT NULL,
    tracking_id      VARCHAR(100) NOT NULL,
    order_id         BIGINT NOT NULL,
    status           ENUM('pending','in_progress','completed','on_hold','failed') DEFAULT 'pending',
    delivered_to     VARCHAR(255) NULL,
    delivery_date    DATE NULL,
    delivery_address VARCHAR(500) NULL,
    metadata         JSON NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vin (vin),
    INDEX idx_tracking_id (tracking_id)
);

-- 9. Installation Tickets
CREATE TABLE IF NOT EXISTS installation_tickets (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_no        VARCHAR(100) NOT NULL COMMENT 'Same TKT-XXXX as order_vehicles.ticket_id',
    vin              VARCHAR(100) NOT NULL,
    tracking_id      VARCHAR(100) NOT NULL,
    order_id         BIGINT NOT NULL,
    status           ENUM('pending','in_progress','completed','on_hold','failed') DEFAULT 'pending',
    technician_name  VARCHAR(255) NULL,
    scheduled_date   DATE NULL,
    device_status    VARCHAR(100) NULL COMMENT 'Device communication status for completion validation',
    metadata         JSON NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vin (vin),
    INDEX idx_tracking_id (tracking_id)
);

-- 10. AIS140 Tickets
CREATE TABLE IF NOT EXISTS ais140_tickets (
    id                                    BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_no                             VARCHAR(100) NOT NULL UNIQUE COMMENT 'Same TKT-XXXX when created with order',
    vin                                   VARCHAR(100) NOT NULL,
    tracking_id                           VARCHAR(100) NOT NULL,
    order_tracking_id                     VARCHAR(100) NULL COMMENT 'Same as tracking_id if created with order (Case 2)',
    vehicle_details                       JSON NULL,
    customer_details                      JSON NULL,
    status                                ENUM('pending','in_progress','completed','on_hold','failed') DEFAULT 'pending',
    handler_details                       JSON NULL COMMENT 'Filled when moved to in_progress',
    -- Status / handler fields (populated by TML backend)
    remark                                TEXT         NULL COMMENT 'Status remark or notes',
    handler                               VARCHAR(255) NULL COMMENT 'Assigned handler name',
    handler_contact                       VARCHAR(100) NULL COMMENT 'Handler phone/email',
    process_datetime                      DATETIME     NULL COMMENT 'When ticket was processed',
    -- AIS140-specific certification fields
    certification_registration_datetime   DATETIME     NULL COMMENT 'When certificate was registered',
    certification_expiry_date             DATE         NULL COMMENT 'Certificate expiry date',
    certificate_file_location             VARCHAR(1000) NULL COMMENT 'Public URL / S3 URL of certificate',
    certificate_file_name                 VARCHAR(500) NULL,
    certificate_file_path                 VARCHAR(1000) NULL COMMENT 'S3 internal path',
    validation_errors                     JSON NULL,
    created_at                            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vin (vin),
    INDEX idx_tracking_id (tracking_id)
);

-- 11. Mining Tickets
CREATE TABLE IF NOT EXISTS mining_tickets (
    id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
    mining_ticket_no      VARCHAR(100) NOT NULL UNIQUE COMMENT 'Same TKT-XXXX when created with order',
    vin                   VARCHAR(100) NOT NULL,
    tracking_id           VARCHAR(100) NOT NULL,
    order_tracking_id     VARCHAR(100) NULL,
    vehicle_details       JSON NULL,
    customer_details      JSON NULL,
    status                ENUM('pending','in_progress','completed','on_hold','failed') DEFAULT 'pending',
    handler_details       JSON NULL,
    -- Status / handler fields (populated by TML backend)
    remark                TEXT         NULL COMMENT 'Status remark or notes',
    handler               VARCHAR(255) NULL COMMENT 'Assigned handler name',
    handler_contact       VARCHAR(100) NULL COMMENT 'Handler phone/email',
    process_datetime      DATETIME     NULL COMMENT 'When ticket was processed',
    polling_datetime      DATETIME     NULL COMMENT 'Last polling timestamp',
    certificate_file_name VARCHAR(500)  NULL,
    certificate_file_path VARCHAR(1000) NULL COMMENT 'S3 path',
    validation_errors     JSON NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vin (vin),
    INDEX idx_tracking_id (tracking_id)
);

-- ============================================================
-- SAMPLE DATA
-- ============================================================
INSERT IGNORE INTO api_clients (client_id, client_secret, client_name, status)
VALUES ('tml-client-id', 'tml-client-secret', 'TML Vendor Integration', 1);
