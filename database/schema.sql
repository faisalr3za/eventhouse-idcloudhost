-- Database Schema untuk Registrasi Pengunjung
-- PostgreSQL

-- Drop tables if exists (untuk development)
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS checkins CASCADE;
DROP TABLE IF EXISTS visitors CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS guest_categories CASCADE;
DROP TABLE IF EXISTS events CASCADE;

-- Tabel Events
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    nama_acara VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    tanggal DATE NOT NULL,
    waktu_mulai TIME NOT NULL,
    waktu_selesai TIME NOT NULL,
    lokasi TEXT NOT NULL,
    max_capacity INTEGER DEFAULT 1000,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Guest Categories
CREATE TABLE guest_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) NOT NULL, -- Hex color code
    icon VARCHAR(50) NOT NULL, -- Bootstrap icon class
    priority INTEGER NOT NULL, -- 1=highest priority (VIP), 4=lowest (Participant)
    benefits TEXT, -- JSON string of benefits
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default guest categories
INSERT INTO guest_categories (name, code, description, color, icon, priority, benefits) VALUES
('VIP', 'VIP', 'Very Important Person - Tamu terhormat dengan akses khusus', '#FFD700', 'bi-crown-fill', 1, 
 '["VIP Lounge Access", "Priority Check-in", "Welcome Kit Premium", "Reserved Parking", "Meet & Greet Session", "VIP Dining Area"]'),
('Sponsor', 'SPR', 'Sponsor acara dengan hak istimewa khusus', '#FF6B35', 'bi-handshake-fill', 2, 
 '["Sponsor Booth Access", "Networking Session", "Brand Visibility", "Premium Location", "Marketing Materials", "Logo Placement"]'),
('Speaker', 'SPK', 'Pembicara dan narasumber acara', '#4ECDC4', 'bi-mic-fill', 2, 
 '["Speaker Lounge", "AV Equipment Support", "Accommodation Assistance", "Transportation", "Speaker Kit", "Recording Access"]'),
('Participant', 'PTC', 'Peserta umum acara', '#45B7D1', 'bi-people-fill', 4, 
 '["Event Access", "Event Materials", "Certificate of Attendance", "Networking Opportunity", "Refreshments", "Event Swag"]');

-- Tabel Admin Users
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('penyelenggara', 'panitia', 'scanner')),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin users
INSERT INTO admin_users (username, email, password_hash, full_name, role) VALUES
('admin', 'admin@event.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Super Admin', 'penyelenggara'),
('panitia1', 'panitia1@event.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Panitia Satu', 'panitia');
-- Password default: "password" (harus diganti di production)

-- Tabel Visitors/Guests
CREATE TABLE visitors (
    id SERIAL PRIMARY KEY,
    registration_code VARCHAR(20) UNIQUE NOT NULL,
    nama_lengkap VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    company VARCHAR(255),
    position VARCHAR(255),
    category_id INTEGER NOT NULL REFERENCES guest_categories(id),
    event_id INTEGER NOT NULL REFERENCES events(id),
    qr_code_data TEXT, -- Encrypted JSON data untuk QR code
    qr_code_url VARCHAR(500), -- Path ke file QR code image
    status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'checked_in', 'no_show', 'cancelled')),
    special_requirements TEXT,
    dietary_restrictions TEXT,
    emergency_contact VARCHAR(255),
    emergency_phone VARCHAR(20),
    photo_url VARCHAR(500), -- Optional profile photo
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Check-ins
CREATE TABLE checkins (
    id SERIAL PRIMARY KEY,
    visitor_id INTEGER NOT NULL REFERENCES visitors(id),
    checkin_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checkout_time TIMESTAMP NULL,
    location VARCHAR(255) DEFAULT 'Main Entrance',
    gate_number VARCHAR(10),
    scanned_by VARCHAR(255) NOT NULL, -- Admin username yang scan
    device_info TEXT, -- Browser/device info
    ip_address INET, -- IP address scanner
    latitude DECIMAL(10, 8) NULL, -- GPS coordinates (optional)
    longitude DECIMAL(11, 8) NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Activity Logs
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NULL REFERENCES admin_users(id), -- NULL for system/public actions
    visitor_id INTEGER NULL REFERENCES visitors(id),
    action VARCHAR(100) NOT NULL, -- 'register', 'checkin', 'update', 'login', etc
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    additional_data JSONB, -- Extra data in JSON format
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_visitors_registration_code ON visitors(registration_code);
CREATE INDEX idx_visitors_email ON visitors(email);
CREATE INDEX idx_visitors_category ON visitors(category_id);
CREATE INDEX idx_visitors_event ON visitors(event_id);
CREATE INDEX idx_visitors_status ON visitors(status);
CREATE INDEX idx_visitors_registered_at ON visitors(registered_at);

CREATE INDEX idx_checkins_visitor ON checkins(visitor_id);
CREATE INDEX idx_checkins_time ON checkins(checkin_time);
CREATE INDEX idx_checkins_scanned_by ON checkins(scanned_by);

CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);

CREATE INDEX idx_guest_categories_priority ON guest_categories(priority);

-- Create views for easier reporting
CREATE VIEW visitor_summary AS
SELECT 
    v.id,
    v.registration_code,
    v.nama_lengkap,
    v.email,
    v.phone,
    v.company,
    v.position,
    gc.name as category_name,
    gc.code as category_code,
    gc.color as category_color,
    gc.icon as category_icon,
    e.nama_acara,
    e.tanggal as event_date,
    e.lokasi as event_location,
    v.status,
    v.registered_at,
    c.checkin_time,
    c.scanned_by,
    CASE 
        WHEN c.checkin_time IS NOT NULL THEN 'Hadir'
        WHEN v.status = 'confirmed' THEN 'Terkonfirmasi'
        WHEN v.status = 'registered' THEN 'Terdaftar'
        WHEN v.status = 'cancelled' THEN 'Dibatalkan'
        ELSE 'Tidak Hadir'
    END as attendance_status
FROM visitors v
LEFT JOIN guest_categories gc ON v.category_id = gc.id
LEFT JOIN events e ON v.event_id = e.id
LEFT JOIN checkins c ON v.id = c.visitor_id;

-- Create view for dashboard statistics
CREATE VIEW dashboard_stats AS
SELECT 
    e.id as event_id,
    e.nama_acara,
    COUNT(v.id) as total_registered,
    COUNT(CASE WHEN v.status = 'registered' THEN 1 END) as total_pending,
    COUNT(CASE WHEN v.status = 'confirmed' THEN 1 END) as total_confirmed,
    COUNT(c.id) as total_checkedin,
    COUNT(CASE WHEN gc.code = 'VIP' THEN 1 END) as total_vip,
    COUNT(CASE WHEN gc.code = 'SPR' THEN 1 END) as total_sponsor,
    COUNT(CASE WHEN gc.code = 'SPK' THEN 1 END) as total_speaker,
    COUNT(CASE WHEN gc.code = 'PTC' THEN 1 END) as total_participant
FROM events e
LEFT JOIN visitors v ON e.id = v.event_id
LEFT JOIN guest_categories gc ON v.category_id = gc.id
LEFT JOIN checkins c ON v.id = c.visitor_id
GROUP BY e.id, e.nama_acara;

-- Function to generate registration code
CREATE OR REPLACE FUNCTION generate_registration_code(category_code VARCHAR(10))
RETURNS VARCHAR(20) AS $$
DECLARE
    next_number INTEGER;
    new_code VARCHAR(20);
BEGIN
    -- Get next number for this category
    SELECT COALESCE(MAX(CAST(SUBSTRING(registration_code FROM 4) AS INTEGER)), 0) + 1
    INTO next_number
    FROM visitors v
    JOIN guest_categories gc ON v.category_id = gc.id
    WHERE gc.code = category_code;
    
    -- Format: VIP001, SPR001, SPK001, PTC001
    new_code := category_code || LPAD(next_number::TEXT, 3, '0');
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate registration code
CREATE OR REPLACE FUNCTION set_registration_code()
RETURNS TRIGGER AS $$
DECLARE
    category_code VARCHAR(10);
BEGIN
    -- Get category code
    SELECT code INTO category_code
    FROM guest_categories
    WHERE id = NEW.category_id;
    
    -- Generate registration code if not provided
    IF NEW.registration_code IS NULL OR NEW.registration_code = '' THEN
        NEW.registration_code := generate_registration_code(category_code);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_registration_code
    BEFORE INSERT ON visitors
    FOR EACH ROW
    EXECUTE FUNCTION set_registration_code();

-- Insert sample event
INSERT INTO events (nama_acara, deskripsi, tanggal, waktu_mulai, waktu_selesai, lokasi, max_capacity) VALUES
('Tech Conference 2024', 'Konferensi teknologi terbesar tahun ini', '2024-08-15', '08:00:00', '18:00:00', 'Jakarta Convention Center', 500);

-- Create sample data (optional, untuk testing)
-- INSERT INTO visitors (nama_lengkap, email, phone, company, position, category_id, event_id) VALUES
-- ('John Doe', 'john@example.com', '08123456789', 'PT Example', 'CEO', 1, 1),
-- ('Jane Smith', 'jane@sponsor.com', '08123456788', 'Sponsor Corp', 'Marketing Director', 2, 1),
-- ('Dr. Ahmad', 'ahmad@university.edu', '08123456787', 'University', 'Professor', 3, 1),
-- ('Budi Santoso', 'budi@email.com', '08123456786', 'Startup Inc', 'Developer', 4, 1);
