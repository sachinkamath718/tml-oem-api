-- ============================================================
-- TML OEM API Integration - Full MySQL Schema v2
-- ============================================================

-- 1. API Clients
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

-- 3. Orders (updated)
CREATE TABLE IF NOT EXISTS orders (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_number     VARCHAR(100) NOT NULL UNIQUE,
    tml_order_id     VARCHAR(100) NULL COMMENT 'Order ID from TML system',
    tracking_id      VARCHAR(100) NOT NULL COMMENT 'Common tracking ID shared across modules',
    client_ref_id    BIGINT NOT NULL,
    oem_name         VARCHAR(255),
    device_type      VARCHAR(100) NULL,
    total_vehicles   INT DEFAULT 0,
    status           ENUM('pending','in_progress','completed','on_hold','failed') DEFAULT 'pending',
    customer_details JSON NULL COMMENT 'name, pan, gst, email, contact_number',
    created_by       VARCHAR(255),
    metadata         JSON NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_ref_id) REFERENCES api_clients(id)
);

-- 4. Order Vehicles / Tickets (1 VIN = 1 Ticket, updated)
CREATE TABLE IF NOT EXISTS order_vehicles (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id          BIGINT NOT NULL,
    vin               VARCHAR(100) NOT NULL UNIQUE,
    ticket_id         VARCHAR(100) NOT NULL UNIQUE,
    tracking_id       VARCHAR(100) NOT NULL,
    dispatch_location VARCHAR(500) NULL,
    -- Vehicle fields
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
    -- Device fields (filled post-fitment)
    iccid             VARCHAR(100) NULL,
    device_imei       VARCHAR(100) NULL,
    device_make       VARCHAR(100) NULL,
    device_model      VARCHAR(100) NULL,
    -- Products requested
    products          JSON NULL COMMENT 'Array of products: AIS140, MINING, FLEET_TRACK, etc.',
    -- Linked ticket numbers
    ais140_ticket_no  VARCHAR(100) NULL,
    mining_ticket_no  VARCHAR(100) NULL,
    -- Status
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
    vin         VARCHAR(100) NULL COMMENT 'NULL=order-level, set=vehicle-level',
    stage       VARCHAR(100) NULL COMMENT 'ORDER_CREATED, TCU_SHIPPED, TCU_DELIVERED, DEVICE_INSTALLED, etc.',
    from_status VARCHAR(50)  NULL,
    to_status   VARCHAR(50)  NOT NULL,
    changed_by  VARCHAR(255) NULL,
    notes       TEXT         NULL,
    metadata    JSON         NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 7. AIS140 Tickets
CREATE TABLE IF NOT EXISTS ais140_tickets (
    id                           BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_no                    VARCHAR(100) NOT NULL UNIQUE,
    vin                          VARCHAR(100) NOT NULL,
    tracking_id                  VARCHAR(100) NOT NULL,
    order_tracking_id            VARCHAR(100) NULL COMMENT 'Linked order tracking ID if created together',
    vehicle_details              JSON NULL,
    customer_details             JSON NULL,
    status                       ENUM('pending','in_progress','completed','on_hold','failed') DEFAULT 'pending',
    handler_details              JSON NULL COMMENT 'Filled when moved to in_progress',
    certificate_file_name        VARCHAR(500) NULL,
    certificate_file_path        VARCHAR(1000) NULL COMMENT 'S3 path',
    validation_errors            JSON NULL,
    created_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vin (vin),
    INDEX idx_tracking_id (tracking_id)
);

-- 8. Mining Tickets
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
