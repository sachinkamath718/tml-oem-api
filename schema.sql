-- ============================================================
-- TML OEM API Integration - Full MySQL Schema
-- ============================================================

-- 1. API Clients (Token Generation)
CREATE TABLE api_clients (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    client_id   VARCHAR(150) NOT NULL UNIQUE,
    client_secret VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) NULL,
    status      TINYINT NOT NULL DEFAULT 1 COMMENT '1 = Active, 0 = Inactive',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Token Logs
CREATE TABLE token_logs (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    client_ref_id BIGINT NOT NULL,
    access_token  TEXT NOT NULL,
    token_type    VARCHAR(50) NOT NULL DEFAULT 'Bearer',
    expires_in    INT NOT NULL DEFAULT 43200 COMMENT '12 hours in seconds',
    expires_at    DATETIME NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_ref_id) REFERENCES api_clients(id) ON DELETE CASCADE
);

-- 3. Orders
CREATE TABLE orders (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_number   VARCHAR(100) NOT NULL UNIQUE,
    tracking_id    VARCHAR(100) NOT NULL              COMMENT 'Common tracking ID shared across modules',
    client_ref_id  BIGINT NOT NULL,
    oem_name       VARCHAR(255),
    total_vehicles INT DEFAULT 0,
    status         ENUM('pending','in_progress','completed','on_hold','failed') DEFAULT 'pending',
    created_by     VARCHAR(255),
    metadata       JSON                               COMMENT 'Extra stage-wise data',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_ref_id) REFERENCES api_clients(id)
);

-- 4. Order Vehicles / Tickets (1 VIN = 1 Ticket)
CREATE TABLE order_vehicles (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id          BIGINT NOT NULL,
    vin               VARCHAR(100) NOT NULL UNIQUE    COMMENT 'Vehicle Identification Number',
    ticket_id         VARCHAR(100) NOT NULL UNIQUE    COMMENT 'System-generated per VIN',
    tracking_id       VARCHAR(100) NOT NULL           COMMENT 'Same as parent order tracking_id',
    dispatch_location VARCHAR(500)                    COMMENT 'Different locations per vehicle allowed',
    status            ENUM('pending','in_progress','completed','on_hold','failed') DEFAULT 'pending',
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 5. Order Status History (Audit Trail)
CREATE TABLE order_status_history (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id    BIGINT NOT NULL,
    vin         VARCHAR(100)   COMMENT 'NULL = order-level change, set = vehicle-level change',
    from_status VARCHAR(50),
    to_status   VARCHAR(50) NOT NULL,
    changed_by  VARCHAR(255),
    notes       TEXT,
    metadata    JSON           COMMENT 'Stage-wise metadata, timestamps, handler details',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ============================================================
-- SAMPLE DATA
-- ============================================================

INSERT INTO api_clients (client_id, client_secret, client_name, status)
VALUES ('tml-client-id', 'tml-client-secret', 'TML Vendor Integration', 1);

INSERT INTO token_logs (client_ref_id, access_token, token_type, expires_in, expires_at)
VALUES (
    1,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample.jwt.token.xyz123',
    'Bearer',
    43200,
    DATE_ADD(NOW(), INTERVAL 12 HOUR)
);
