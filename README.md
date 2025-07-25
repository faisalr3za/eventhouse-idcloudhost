# EventHouse by IDCloudHost SaaS - Event Registration Platform

<div align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/Node.js-18+-green.svg" alt="Node.js">
  <img src="https://img.shields.io/badge/PostgreSQL-14+-blue.svg" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Multi--Tenant-Yes-success.svg" alt="Multi-Tenant">
</div>

## 🚀 Overview

**EventHouse by IDCloudHost SaaS** adalah platform registrasi acara berbasis SaaS (Software as a Service) yang komprehensif dengan sistem check-in menggunakan QR Code. Platform ini dirancang khusus untuk pasar Indonesia dengan dukungan payment gateway lokal seperti Midtrans dan Xendit.

### ✨ Fitur Utama

#### 🏢 **Multi-Tenant Architecture**
- **Subdomain Support**: `demo.eventhouse.com`
- **Custom Domain**: `events.yourcompany.com`  
- **Data Isolation**: Setiap tenant memiliki data terpisah
- **White Label**: Branding per tenant

#### 💳 **Payment Gateway Indonesia**
- **Midtrans Integration**: Kartu kredit, VA Bank, GoPay, ShopeePay, DANA, QRIS
- **Xendit Integration**: Credit card, E-wallet, Bank transfer, Retail outlets
- **Multi-Currency**: IDR dan USD
- **Subscription Management**: Monthly/Yearly billing

#### 🎫 **Event Management**
- **QR Code Generation**: Otomatis untuk setiap peserta
- **Email Integration**: Konfirmasi registrasi otomatis
- **Category Management**: VIP, Sponsor, Speaker, Participant
- **Real-time Check-in**: Scanner QR menggunakan smartphone

#### 📊 **Analytics & Reporting**
- **Real-time Dashboard**: Statistik check-in live
- **Advanced Analytics**: Materialized views untuk performa
- **Export Data**: CSV/Excel export
- **Activity Logs**: Audit trail lengkap

## 🏗️ Tech Stack

### Backend
- **Runtime**: Node.js 18+ dengan Express.js
- **Database**: PostgreSQL 14+ dengan advanced indexing
- **Authentication**: JWT dengan role-based access
- **Session**: PostgreSQL session store
- **Email**: Nodemailer dengan template HTML
- **File Upload**: Multer dengan Sharp image processing
- **Logging**: Winston dengan daily rotation

### Frontend
- **UI Framework**: Bootstrap 5 dengan custom components
- **JavaScript**: Vanilla JS dengan modern ES6+
- **Icons**: Bootstrap Icons + Font Awesome
- **QR Scanner**: HTML5-QRCode library
- **Charts**: Chart.js untuk analytics

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx untuk production
- **Process Manager**: PM2 untuk deployment
- **Health Checks**: Built-in monitoring endpoints

## 📁 Struktur Proyek

```
eventhouse-idcloudhost/
├── 📁 src/                     # Source code utama
│   ├── 📁 controllers/         # Request handlers
│   ├── 📁 models/             # Database models
│   ├── 📁 routes/             # API routes
│   ├── 📁 middleware/         # Custom middleware
│   ├── 📁 services/           # Business logic
│   │   ├── paymentService.js  # Midtrans & Xendit
│   │   └── emailService.js    # Email templates
│   ├── 📁 utils/              # Utilities
│   └── app.js                 # Main application
├── 📁 config/                  # Configuration files
│   └── database.js            # PostgreSQL connection
├── 📁 database/               # Database schemas
│   ├── saas-schema.sql        # Multi-tenant schema
│   └── payment-tables.sql     # Payment integration
├── 📁 public/                 # Static assets
│   ├── 📁 assets/            # Images, CSS, JS
│   ├── 📁 tenant/            # Tenant-specific pages
│   ├── 📁 admin/             # Admin dashboard
│   └── 📁 js/                # Frontend JavaScript
│       ├── registration.js    # Registration logic
│       └── payment.js        # Payment integration
├── 📁 scripts/                # Deployment scripts
├── 📁 tests/                  # Unit & integration tests
├── 📁 logs/                   # Application logs
├── 🐳 docker-compose.yml      # Docker services
├── 📄 package.json           # Dependencies
└── 🔐 .env                    # Environment variables
```

## Kategori Tamu

### 1. VIP (Very Important Person)
- **Badge**: Gold dengan icon crown
- **Benefits**: VIP Lounge, Priority Check-in, Welcome Kit Premium
- **Registration Code**: VIP001, VIP002, ...

### 2. Sponsor  
- **Badge**: Orange dengan icon handshake
- **Benefits**: Sponsor Area Access, Networking Session, Branding Visibility
- **Registration Code**: SPR001, SPR002, ...

### 3. Speaker
- **Badge**: Teal dengan icon microphone  
- **Benefits**: Speaker Lounge, AV Support, Accommodation
- **Registration Code**: SPK001, SPK002, ...

### 4. Participant (Peserta)
- **Badge**: Blue dengan icon users
- **Benefits**: Event Access, Materials, Certificate
- **Registration Code**: PTC001, PTC002, ...

## User Roles & Access Control

### Public Users (Peserta)
✅ **Dapat Akses:**
- Form registrasi publik
- Download QR code dari email
- Halaman informasi acara

❌ **Tidak Dapat Akses:**
- Dashboard admin
- Scanner QR code
- Data peserta lain

### Panitia (Event Staff)  
✅ **Dapat Akses:**
- Login dashboard admin
- Scanner QR code untuk check-in
- Lihat daftar peserta (read-only)
- Update status check-in

❌ **Tidak Dapat Akses:**
- Edit/hapus data peserta
- Laporan lengkap
- Manage user admin

### Penyelenggara (Event Organizer)
✅ **Full Access:**
- Semua fitur dashboard admin
- CRUD data peserta
- Generate & export laporan
- Manage event settings
- Manage admin users

## Flow Aplikasi

### 1. Registrasi Peserta (Public)
```
Landing Page → Form Registrasi → Validasi Data → 
Generate QR Code → Kirim Email → Halaman Sukses
```

**Halaman Registrasi (Bootstrap Form):**
- Form dengan validation
- Dropdown kategori tamu
- Upload foto (optional)
- Terms & conditions checkbox

### 2. Admin Login & Dashboard
```
Login Page → Authentication → Dashboard Home → 
Choose Action (Scan/View/Report)
```

**Dashboard Features:**
- Statistics cards (Total, Check-in, Per Category)
- Recent activity timeline
- Quick actions (Scan QR, Export Data)
- Real-time notifications

### 3. QR Code Scanning
```
Open Scanner → Camera Access → Scan QR → 
Decode Data → Validate → Update Status → Show Result
```

**Scanner Interface:**
- Live camera preview
- QR code detection overlay
- Manual input fallback
- Sound/vibration feedback

## Database Schema (PostgreSQL)

```sql
-- Events table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    nama_acara VARCHAR(255) NOT NULL,
    tanggal DATE NOT NULL,
    lokasi TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active'
);

-- Guest categories
CREATE TABLE guest_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    code VARCHAR(10) NOT NULL,
    color VARCHAR(7) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    priority INTEGER NOT NULL
);

-- Visitors
CREATE TABLE visitors (
    id SERIAL PRIMARY KEY,
    registration_code VARCHAR(20) UNIQUE NOT NULL,
    nama_lengkap VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    company VARCHAR(255),
    category_id INTEGER REFERENCES guest_categories(id),
    event_id INTEGER REFERENCES events(id),
    qr_code_data TEXT,
    qr_code_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'registered',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Check-ins
CREATE TABLE checkins (
    id SERIAL PRIMARY KEY,
    visitor_id INTEGER REFERENCES visitors(id),
    checkin_time TIMESTAMP DEFAULT NOW(),
    scanned_by VARCHAR(255),
    location VARCHAR(255)
);

-- Admin users
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);
```

## API Endpoints

### Public API
```
POST /api/register              # Registrasi peserta
GET  /api/qr/:code             # Download QR code
GET  /api/event-info           # Info acara
```

### Admin API (Authenticated)
```
POST /api/auth/login           # Login admin
GET  /api/admin/dashboard      # Dashboard stats
GET  /api/admin/visitors       # List peserta
POST /api/admin/checkin        # Check-in scan
GET  /api/admin/reports        # Export reports
PUT  /api/admin/visitor/:id    # Update peserta
```

## Bootstrap Components Used

### Public Pages
- **Navbar**: Navigation dengan branding
- **Cards**: Info kategori tamu
- **Forms**: Registration form dengan validation
- **Badges**: Kategori labels
- **Alerts**: Success/error messages
- **Modal**: Terms & conditions

### Admin Dashboard  
- **Sidebar**: Navigation menu
- **Cards**: Statistics dashboard
- **DataTables**: Visitor list dengan sorting/filtering
- **Buttons**: Action buttons dengan icons
- **Progress**: Check-in progress bars
- **Toasts**: Real-time notifications
- **Modal**: Confirmation dialogs

## 💰 Subscription Plans

| Plan | Price (IDR/month) | Events | Visitors | Users | Features |
|------|------------------ |--------|----------|-------|----------|
| **Free** | Rp 0 | 1 | 50 | 1 | Basic QR, Email, Analytics |
| **Starter** | Rp xxx,xxx | 5 | 500 | 3 | Custom branding, CSV export, Priority support |
| **Professional** | Rp x,xxx,xxx | 25 | 2,500 | 10 | White label, API access, Custom domains |
| **Enterprise** | Rp x,xxx,xxx | Unlimited | Unlimited | Unlimited | Everything + Custom features |

> 💡 **Yearly Discount**: 20% off ketika berlangganan 1 tahun 

## 🚀 Mulai Cepat!

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- Docker & Docker Compose (optional)
- Git

### 1. Clone Repository
```bash
git clone https://github.com/eventhouse/eventhouse-idcloudhost.git
cd eventhouse-idcloudhost
```

### 2. Environment Setup
```bash
# Copy environment file
cp .env.example .env

# Edit with your configuration
nano .env
```

### 3. Database Setup
```bash
# Using Docker (Recommended)
docker-compose up -d postgres

# Or install PostgreSQL manually
sudo apt install postgresql postgresql-contrib

# Create database
psql -U postgres -c "CREATE DATABASE regis_db;"

# Run migrations
npm run db:migrate
```

### 4. Install Dependencies
```bash
npm install
```

### 5. Start Application
```bash
# Development
npm run dev

# Production
npm start

# Using Docker
docker-compose up -d
```

### 6. Access Application
- **Main Site**: http://localhost:3000
- **Demo Tenant**: http://demo.localhost:3000
- **Admin Panel**: http://demo.localhost:3000/admin
- **API Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/health

## ⚙️ Configuration

### Environment Variables

#### Basic Configuration
```env
NODE_ENV=development
PORT=3000
APP_NAME=EventHouse by IDCloudHost SaaS
APP_URL=http://localhost:3000
```

#### Database
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=regis_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_POOL_MAX=20
```

#### Authentication
```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
SESSION_SECRET=your-session-secret-key
```

#### Email Configuration
```env
# Gmail SMTP
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=EventHouse by IDCloudHost <noreply@eventhouse.com>

# Or use other SMTP providers
# EMAIL_HOST=mail.yourdomain.com
# EMAIL_PORT=587
# EMAIL_USER=noreply@yourdomain.com
# EMAIL_PASS=your-email-password
```

#### Payment Gateways

**Midtrans (Sandbox)**
```env
MIDTRANS_SERVER_KEY=SB-Mid-server-your-server-key-here
MIDTRANS_CLIENT_KEY=SB-Mid-client-your-client-key-here
MIDTRANS_MERCHANT_ID=your-merchant-id
```

**Xendit (Test)**
```env
XENDIT_SECRET_KEY=xnd_development_your-secret-key-here
XENDIT_PUBLIC_KEY=xnd_public_development_your-public-key-here
XENDIT_WEBHOOK_TOKEN=your-webhook-verification-token
```

**Production Setup**
```env
# Change to production keys
MIDTRANS_SERVER_KEY=Mid-server-production-key
XENDIT_SECRET_KEY=xnd_production_your-secret-key
```

### Multi-Tenant Setup

#### Subdomain Configuration
1. **Development**: Edit `/etc/hosts`
```
127.0.0.1 demo.localhost
127.0.0.1 tenant2.localhost
```

2. **Production**: Setup DNS records
```
*.yourdomain.com CNAME yourdomain.com
```

3. **Nginx Configuration**
```nginx
server {
    listen 80;
    server_name *.eventhouse.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🎯 Default Credentials

### Demo Tenant
- **Tenant Slug**: `demo`
- **Subdomain**: `demo.localhost:3000`

### Admin Users
| Role | Username | Password | Access Level |
|------|----------|----------|-------------|
| **Penyelenggara** | `admin` | `password` | Full access |
| **Panitia** | `panitia1` | `password` | Scanner + Read-only |

> ⚠️ **Security Warning**: Change default passwords in production!

## 📱 Mobile Web App (PWA)

**EventHouse by IDCloudHost Mobile** adalah Progressive Web App (PWA) yang berjalan di web browser tanpa perlu install aplikasi native. Cocok untuk panitia yang perlu scanner QR code mobile.

### ✨ Fitur Mobile Web App
- **📱 Progressive Web App**: Install langsung dari browser
- **📷 Camera Access**: Akses kamera untuk scan QR code
- **🔄 Offline Support**: Bekerja tanpa internet (dengan sinkronisasi)
- **🎯 Real-time Scanner**: Scan QR code dengan feedback suara & getar
- **📊 Live Statistics**: Stats check-in real-time
- **🔄 Auto-restart**: Scanner otomatis restart setelah scan
- **⌨️ Keyboard Shortcuts**: Space/Enter untuk start, Escape untuk stop
- **🔄 Camera Switch**: Ganti antara kamera depan dan belakang
- **📝 Manual Input**: Input kode registrasi secara manual
- **🔔 Push Notifications**: Notifikasi check-in

### 🚀 Akses Mobile Scanner

```bash
# URL Mobile Scanner
http://demo.localhost:3000/mobile/scanner.html

# Production
https://demo.eventhouse.com/mobile/scanner.html
```

### 📲 Install sebagai PWA

#### Android (Chrome/Edge)
1. Buka URL scanner di browser
2. Tap menu **⋮** → **"Add to Home screen"**
3. Konfirmasi install
4. Icon muncul di home screen

#### iOS (Safari)
1. Buka URL scanner di Safari
2. Tap **Share** → **"Add to Home Screen"**
3. Konfirmasi dengan **"Add"**
4. Icon muncul di home screen

#### Desktop (Chrome/Edge)
1. Buka URL scanner
2. Klik **Install** icon di address bar
3. Konfirmasi install
4. App bisa dibuka dari Start Menu/Applications

### 🎮 Cara Penggunaan

#### Login Admin
```bash
# Admin harus login dulu di web dashboard
http://demo.localhost:3000/admin/login.html

# Kredensial akan disimpan untuk mobile scanner
```

#### Scan QR Code
1. **Buka Mobile Scanner** dari home screen atau browser
2. **Izinkan Akses Kamera** saat diminta
3. **Arahkan Kamera** ke QR code peserta
4. **Auto Scan** - tidak perlu tekan tombol
5. **Lihat Hasil** - success/error dengan feedback
6. **Auto Restart** - scanner restart otomatis

#### Kontrol Scanner
```javascript
// Keyboard shortcuts
Space/Enter = Start scanner
Escape = Stop scanner

// Button controls
start() = Mulai scan
stop() = Stop scan
switchCamera() = Ganti kamera
processManualCode() = Input manual
```

### 🔧 API Integration

#### QR Scanner API
```javascript
// Check-in visitor via QR scan
POST /api/admin/checkin
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "qr_data": "REG001-encrypted-data",
  "location": "Mobile Scanner",
  "scanned_by": "admin_username",
  "gate_number": "A1"
}

// Response
{
  "success": true,
  "message": "Check-in berhasil",
  "data": {
    "nama_lengkap": "John Doe",
    "category_name": "VIP",
    "company": "Tech Corp",
    "checkin_time": "2024-01-15T10:30:00Z"
  }
}
```

#### Offline Support
```javascript
// Check-ins disimpan offline jika tidak ada internet
// Auto-sync ketika koneksi kembali

// IndexedDB storage
const offlineCheckin = {
  id: 'checkin_' + Date.now(),
  qr_data: 'REG001-data',
  location: 'Mobile Scanner',
  timestamp: new Date().toISOString(),
  token: localStorage.getItem('admin_token')
};

// Background sync saat online
if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
  navigator.serviceWorker.ready.then(registration => {
    return registration.sync.register('background-checkin');
  });
}
```

### 🛠️ Customization

#### Scanner Configuration
```javascript
// Ubah pengaturan scanner
const scannerConfig = {
  fps: 10,                    // Frame per second
  qrbox: { width: 250, height: 250 }, // Scan area
  aspectRatio: 1.0,          // Aspect ratio
  facingMode: 'environment'   // Camera: 'user' or 'environment'
};
```

#### PWA Manifest
```json
// public/manifest.json
{
  "name": "EventHouse by IDCloudHost QR Scanner",
  "short_name": "QR Scanner",
  "start_url": "/mobile/scanner.html",
  "display": "standalone",
  "theme_color": "#007bff",
  "background_color": "#ffffff"
}
```

## 🔌 API Documentation

### Authentication
All admin API endpoints require JWT authentication:
```bash
Authorization: Bearer <jwt_token>
```

### Public Registration API
```bash
# Register new visitor
POST /api/register
Content-Type: application/json

{
  "nama_lengkap": "John Doe",
  "email": "john@example.com",
  "phone": "+6281234567890",
  "company": "Tech Corp",
  "category_id": 4,
  "event_id": 1
}
```

### Payment API
```bash
# Create subscription payment
POST /api/payment/subscription
Authorization: Bearer <token>
Content-Type: application/json

{
  "planId": 2,
  "provider": "midtrans",
  "billingPeriod": "monthly",
  "customerData": {
    "firstName": "John",
    "lastName": "Doe", 
    "email": "john@company.com",
    "phone": "+6281234567890"
  }
}
```

### Webhook Endpoints
```bash
# Midtrans webhook
POST /api/payment/webhook/midtrans

# Xendit webhook  
POST /api/payment/webhook/xendit
```

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### API Testing
```bash
# Using curl
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"nama_lengkap":"Test User","email":"test@example.com"}'

# Using Postman
# Import collection from /docs/postman/
```

### Load Testing
```bash
# Install artillery
npm install -g artillery

# Run load test
artillery run tests/load/registration.yml
```

## 🚀 Deployment

### Using Docker
```bash
# Build image
docker build -t eventhouse-idcloudhost .

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start ecosystem.config.js --env production

# Monitor
pm2 monit

# Logs
pm2 logs eventhouse-idcloudhost
```

### Environment-specific Commands
```bash
# Staging
npm run deploy:staging

# Production
npm run deploy:production

# Rollback
pm2 reload eventhouse-idcloudhost --update-env
```

### SSL Setup (Let's Encrypt)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d eventhouse.com -d *.eventhouse.com

# Auto-renewal
sudo crontab -e
0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Monitoring & Logging

### Health Checks
```bash
# Application health
GET /health

# Database health
GET /api/health/db

# Payment gateway health
GET /api/health/payment
```

### Log Files
```bash
# Application logs
tail -f logs/combined.log

# Error logs
tail -f logs/error.log

# Access logs (Nginx)
tail -f /var/log/nginx/access.log
```

### Metrics
- **Uptime**: Built-in process monitoring
- **Database**: PostgreSQL stats and slow query log
- **API**: Response time and error rate tracking
- **Payment**: Transaction success/failure rates

## 🔒 Security Best Practices

### Production Checklist
- [ ] Change all default passwords
- [ ] Use HTTPS only (SSL/TLS)
- [ ] Configure proper CORS origins
- [ ] Set up rate limiting
- [ ] Enable PostgreSQL SSL
- [ ] Configure secure session cookies
- [ ] Set up firewall rules
- [ ] Regular security updates
- [ ] Monitor for vulnerabilities
- [ ] Backup encryption

### Data Protection
- **Encryption**: QR codes encrypted with AES-256
- **Hashing**: Passwords with bcrypt (12 rounds)
- **Validation**: Input sanitization on all endpoints
- **Audit**: Complete activity logging
- **GDPR**: Data export and deletion support

## 🤝 Contributing

### Development Setup
```bash
# Fork and clone
git clone https://github.com/yourusername/eventhouse-idcloudhost.git

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and test
npm run lint
npm test

# Commit with conventional commits
git commit -m "feat: add amazing feature"

# Push and create PR
git push origin feature/amazing-feature
```

### Code Style
- **ESLint**: Airbnb configuration
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks
- **Conventional Commits**: Commit message format

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- **API Docs**: http://localhost:3000/api/docs
- **Wiki**: [GitHub Wiki](https://github.com/eventhouse/eventhouse-idcloudhost/wiki)
- **FAQ**: [Frequently Asked Questions](docs/FAQ.md)

### Community
- **Issues**: [GitHub Issues](https://github.com/eventhouse/eventhouse-idcloudhost/issues)
- **Discussions**: [GitHub Discussions](https://github.com/eventhouse/eventhouse-idcloudhost/discussions)

---

<div align="center">
  <p><strong>Code with ❤️ from Sukabumi by IDCluodHost for Indonesian Event Organizers</strong></p>
  <p>EventHouse by IDCloudHost © 2025 - Empowering Events, One Registration at a Time</p>
</div>
