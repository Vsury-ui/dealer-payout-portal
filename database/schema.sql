-- Dealer Payout Portal Database Schema
-- MySQL 8.0+

-- Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    ad_id VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Admin', 'Maker', 'Checker', 'Business', 'BusinessHead', 'Finance', 'MIS', 'Dealer', 'OEM') NOT NULL,
    business_line VARCHAR(100),
    user_code VARCHAR(50) UNIQUE,
    login_access BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    updated_by INT,
    INDEX idx_username (username),
    INDEX idx_ad_id (ad_id),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Roles & Permissions Table
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dealers Table
CREATE TABLE dealers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dealer_code VARCHAR(50) UNIQUE NOT NULL,
    dealer_name VARCHAR(255) NOT NULL,
    gst_number VARCHAR(15) NOT NULL,
    pan_number VARCHAR(10) NOT NULL,
    state VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    status ENUM('Pending', 'Approved', 'Rejected', 'Active', 'Inactive') DEFAULT 'Pending',
    approval_remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT NOT NULL,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    INDEX idx_dealer_code (dealer_code),
    INDEX idx_status (status),
    INDEX idx_gst (gst_number),
    INDEX idx_pan (pan_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payout Cycles Table
CREATE TABLE payout_cycles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cycle_name VARCHAR(255) NOT NULL,
    cycle_code VARCHAR(50) UNIQUE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('Draft', 'Active', 'Processing', 'Completed', 'Cancelled') DEFAULT 'Draft',
    total_cases INT DEFAULT 0,
    total_amount DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_cycle_code (cycle_code),
    INDEX idx_status (status),
    INDEX idx_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payout Cases Table
CREATE TABLE payout_cases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_number VARCHAR(100) UNIQUE NOT NULL,
    cycle_id INT NOT NULL,
    dealer_id INT NOT NULL,
    payout_type VARCHAR(50) NOT NULL,
    base_amount DECIMAL(15, 2) NOT NULL,
    incentive_amount DECIMAL(15, 2) NOT NULL,
    deduction_amount DECIMAL(15, 2) DEFAULT 0.00,
    recovery_amount DECIMAL(15, 2) DEFAULT 0.00,
    net_amount DECIMAL(15, 2) NOT NULL,
    status ENUM('New', 'PayoutGenerated', 'Held', 'Released', 'Cancelled', 'ApprovedChecker', 'ApprovedBusiness', 'InvoiceGenerated', 'InvoiceAccepted', 'Paid') DEFAULT 'New',
    hold_reason TEXT,
    cancellation_reason TEXT,
    bre_calculation JSON,
    raw_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    approved_checker_at TIMESTAMP NULL,
    approved_checker_by INT,
    approved_business_at TIMESTAMP NULL,
    approved_business_by INT,
    FOREIGN KEY (cycle_id) REFERENCES payout_cycles(id) ON DELETE CASCADE,
    FOREIGN KEY (dealer_id) REFERENCES dealers(id),
    FOREIGN KEY (approved_checker_by) REFERENCES users(id),
    FOREIGN KEY (approved_business_by) REFERENCES users(id),
    INDEX idx_case_number (case_number),
    INDEX idx_cycle (cycle_id),
    INDEX idx_dealer (dealer_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoices Table
CREATE TABLE invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    case_id INT NOT NULL,
    dealer_id INT NOT NULL,
    invoice_type ENUM('Payout', 'OEMSubvention', 'Recovery') NOT NULL,
    invoice_amount DECIMAL(15, 2) NOT NULL,
    gst_amount DECIMAL(15, 2) DEFAULT 0.00,
    total_amount DECIMAL(15, 2) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('Generated', 'Pending', 'Accepted', 'VendorUploaded', 'Paid', 'Overdue', 'Cancelled') DEFAULT 'Generated',
    s3_path VARCHAR(500),
    signed_s3_path VARCHAR(500),
    aadhaar_verified BOOLEAN DEFAULT FALSE,
    aadhaar_otp_verified_at TIMESTAMP NULL,
    vendor_uploaded BOOLEAN DEFAULT FALSE,
    vendor_uploaded_at TIMESTAMP NULL,
    invoice_aging_days INT DEFAULT 0,
    tat_breached BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES payout_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (dealer_id) REFERENCES dealers(id),
    INDEX idx_invoice_number (invoice_number),
    INDEX idx_case (case_id),
    INDEX idx_dealer (dealer_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payments Table
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_ref_number VARCHAR(100) UNIQUE NOT NULL,
    invoice_id INT NOT NULL,
    case_id INT NOT NULL,
    dealer_id INT NOT NULL,
    payment_amount DECIMAL(15, 2) NOT NULL,
    payment_date DATE NOT NULL,
    utr_number VARCHAR(100),
    payment_mode VARCHAR(50),
    bank_reference VARCHAR(100),
    oracle_fusion_ref VARCHAR(100),
    status ENUM('Pending', 'Processed', 'Completed', 'Failed', 'Reconciled') DEFAULT 'Pending',
    reconciliation_status ENUM('Pending', 'Matched', 'Mismatched', 'Unmatched') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (case_id) REFERENCES payout_cases(id),
    FOREIGN KEY (dealer_id) REFERENCES dealers(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_payment_ref (payment_ref_number),
    INDEX idx_invoice (invoice_id),
    INDEX idx_utr (utr_number),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OEM Pay-in Table
CREATE TABLE oem_payin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payin_ref_number VARCHAR(100) UNIQUE NOT NULL,
    oem_name VARCHAR(255) NOT NULL,
    payin_type ENUM('Subvention', 'Advance', 'Adjustment') NOT NULL,
    payin_amount DECIMAL(15, 2) NOT NULL,
    payin_date DATE NOT NULL,
    status ENUM('Pending', 'ApprovedChecker', 'ApprovedBusinessHead', 'InvoiceGenerated', 'InvoiceAccepted', 'Adjusted', 'Completed') DEFAULT 'Pending',
    invoice_number VARCHAR(100),
    s3_invoice_path VARCHAR(500),
    adjustment_cycle_id INT,
    advance_balance DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT NOT NULL,
    approved_checker_by INT,
    approved_businesshead_by INT,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_checker_by) REFERENCES users(id),
    FOREIGN KEY (approved_businesshead_by) REFERENCES users(id),
    FOREIGN KEY (adjustment_cycle_id) REFERENCES payout_cycles(id),
    INDEX idx_payin_ref (payin_ref_number),
    INDEX idx_oem (oem_name),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Disputes Table
CREATE TABLE disputes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dispute_number VARCHAR(100) UNIQUE NOT NULL,
    dispute_type ENUM('PayoutDispute', 'InvoiceDispute', 'OEMDispute', 'RecoveryDispute') NOT NULL,
    related_entity_type ENUM('PayoutCase', 'Invoice', 'OEMPayin') NOT NULL,
    related_entity_id INT NOT NULL,
    dealer_id INT,
    raised_by INT NOT NULL,
    raised_by_role ENUM('Dealer', 'OEM', 'Finance', 'Business') NOT NULL,
    dispute_reason TEXT NOT NULL,
    disputed_amount DECIMAL(15, 2),
    supporting_documents JSON,
    status ENUM('Open', 'UnderReview', 'Approved', 'Rejected', 'Resolved', 'Closed') DEFAULT 'Open',
    resolution_remarks TEXT,
    adjustment_cycle_id INT,
    adjustment_amount DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    resolved_by INT,
    FOREIGN KEY (dealer_id) REFERENCES dealers(id),
    FOREIGN KEY (raised_by) REFERENCES users(id),
    FOREIGN KEY (resolved_by) REFERENCES users(id),
    FOREIGN KEY (adjustment_cycle_id) REFERENCES payout_cycles(id),
    INDEX idx_dispute_number (dispute_number),
    INDEX idx_status (status),
    INDEX idx_dealer (dealer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Trail Table
CREATE TABLE audit_trail (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    old_values JSON,
    new_values JSON,
    remarks TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    performed_by INT NOT NULL,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (performed_by) REFERENCES users(id),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_performed_by (performed_by),
    INDEX idx_performed_at (performed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Service Requests Table (Approval Workflows)
CREATE TABLE service_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_number VARCHAR(100) UNIQUE NOT NULL,
    request_type ENUM('DealerApproval', 'PayoutApproval', 'InvoiceApproval', 'OEMApproval', 'DisputeResolution') NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INT NOT NULL,
    current_stage VARCHAR(50) NOT NULL,
    next_stage VARCHAR(50),
    status ENUM('Pending', 'Approved', 'Rejected', 'InProgress', 'Completed') DEFAULT 'Pending',
    assigned_to INT,
    assigned_role VARCHAR(50),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    INDEX idx_request_number (request_number),
    INDEX idx_status (status),
    INDEX idx_assigned (assigned_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- BRE Rules Configuration Table
CREATE TABLE bre_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rule_name VARCHAR(255) NOT NULL,
    rule_code VARCHAR(100) UNIQUE NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    business_line VARCHAR(100),
    rule_logic JSON NOT NULL,
    priority INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_rule_code (rule_code),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications Table
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(100),
    entity_id INT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_read (is_read),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Upload Jobs Table (for BullMQ tracking)
CREATE TABLE upload_jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(100) UNIQUE NOT NULL,
    job_type ENUM('DealerBulkUpload', 'PayoutDataUpload', 'PaymentFileUpload', 'OEMPayinUpload') NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_s3_path VARCHAR(500),
    status ENUM('Queued', 'Processing', 'Completed', 'Failed', 'PartiallyCompleted') DEFAULT 'Queued',
    total_records INT DEFAULT 0,
    processed_records INT DEFAULT 0,
    success_records INT DEFAULT 0,
    failed_records INT DEFAULT 0,
    error_log JSON,
    progress_percentage DECIMAL(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    created_by INT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_job_id (job_id),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin user (password: admin123)
INSERT INTO users (username, ad_id, email, mobile, password_hash, role, user_code, login_access, is_active) 
VALUES ('admin', 'AD001', 'admin@dealerportal.com', '9999999999', '$2a$10$XQzVqvN9K9YxV9YvV9YvVO9YvV9YvV9YvV9YvV9YvV9YvV9YvV9Y', 'Admin', 'USR001', TRUE, TRUE);

-- Insert default roles with permissions
INSERT INTO roles (role_name, description, permissions) VALUES
('Admin', 'Full system access', '{"all": true}'),
('Maker', 'Create and initiate workflows', '{"dealer": ["create", "edit"], "payout": ["create", "upload"], "oem": ["create"]}'),
('Checker', 'Approve/reject workflows', '{"dealer": ["approve", "reject"], "payout": ["approve", "reject"]}'),
('Business', 'Business validation', '{"payout": ["validate", "approve"], "disputes": ["review", "resolve"]}'),
('BusinessHead', 'Executive approvals', '{"oem": ["approve", "reject"], "disputes": ["resolve"]}'),
('Finance', 'Financial operations', '{"invoice": ["create", "edit"], "payment": ["process"], "reconciliation": ["view", "update"]}'),
('MIS', 'Reporting and compliance', '{"reports": ["view", "export"], "audit": ["view"]}'),
('Dealer', 'Dealer operations', '{"payout": ["view"], "invoice": ["accept", "upload"], "disputes": ["raise"]}'),
('OEM', 'OEM operations', '{"oem": ["view"], "invoice": ["upload"], "disputes": ["raise"]}');
