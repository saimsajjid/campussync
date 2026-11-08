-- CampusSync Production PostgreSQL Schema
-- Strict adherence to Data Correctness Invariants (FR-5, FR-6, FR-7, FR-9, FR-11)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & ROLES
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'faculty', 'admin')),
    campus VARCHAR(50) NULL CHECK (campus IN ('Islamabad', 'Lahore', 'Abbottabad') OR campus IS NULL),
    student_id UUID NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. STUDENTS (Authoritative Source of Truth)
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY,
    reg_no VARCHAR(50) UNIQUE NOT NULL,
    cnic VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    program VARCHAR(50) NOT NULL,
    campus VARCHAR(50) NOT NULL CHECK (campus IN ('Islamabad', 'Lahore', 'Abbottabad')),
    semester INT NOT NULL CHECK (semester BETWEEN 1 AND 8),
    status VARCHAR(50) NOT NULL CHECK (status IN ('Active', 'On leave', 'Graduated')),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    emergency_contact VARCHAR(150) NOT NULL,
    attendance NUMERIC(5,2) NOT NULL DEFAULT 0.0 CHECK (attendance BETWEEN 0 AND 100),
    remarks TEXT NULL,
    field_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INT NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_editor_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_graduated_semester CHECK (status != 'Graduated' OR semester = 8)
);

CREATE INDEX IF NOT EXISTS idx_students_reg_no ON students(reg_no);
CREATE INDEX IF NOT EXISTS idx_students_cnic ON students(cnic);
CREATE INDEX IF NOT EXISTS idx_students_campus ON students(campus);

-- 3. HISTORY (Append-Only Audit & Sync Cursor)
CREATE TABLE IF NOT EXISTS history (
    id BIGSERIAL PRIMARY KEY, -- doubles as sync cursor
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    field VARCHAR(100) NOT NULL,
    old_value JSONB NULL,
    new_value JSONB NULL,
    field_version_after INT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('create', 'edit', 'resolve', 'restore')),
    actor_id VARCHAR(100) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    actor_campus VARCHAR(50) NULL,
    device_id VARCHAR(100) NOT NULL,
    op_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_cursor ON history(id);
CREATE INDEX IF NOT EXISTS idx_history_student ON history(student_id);
CREATE INDEX IF NOT EXISTS idx_history_op_id ON history(op_id);

-- Enforce Append-Only Property at Database Level (FR-9.2)
CREATE OR REPLACE FUNCTION prevent_history_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'History entries are immutable and append-only. Modifying or deleting is forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_history_update ON history;
CREATE TRIGGER trg_prevent_history_update
BEFORE UPDATE OR DELETE ON history
FOR EACH ROW EXECUTE FUNCTION prevent_history_tampering();

-- 4. PROCESSED OPS (Idempotency Engine)
CREATE TABLE IF NOT EXISTS processed_ops (
    op_id VARCHAR(100) PRIMARY KEY,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CONFLICTS (Held Divergent Writes)
CREATE TABLE IF NOT EXISTS conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    field VARCHAR(100) NOT NULL,
    base_version INT NOT NULL,
    server_value JSONB NOT NULL,
    server_version INT NOT NULL,
    incoming_value JSONB NOT NULL,
    incoming_op_id VARCHAR(100) NOT NULL,
    actor_id VARCHAR(100) NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    resolved_by VARCHAR(100) NULL,
    resolution VARCHAR(50) NULL,
    resolved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflicts_open ON conflicts(status) WHERE status = 'open';
