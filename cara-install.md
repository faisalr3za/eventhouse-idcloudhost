# Cara Install Proyek EventHouse

Hai teman-teman! Ini panduan gampang buat install proyek EventHouse by IDCloudHost. Yuk ikuti langkah-langkahnya!

## Prasyarat
Pastikan sudah punya beberapa hal berikut:
- **Node.js** (minimal versi 18) dan **npm** (minimal versi 8)
- **PostgreSQL** database
- **Git**
- **Docker** (opsional, kalau mau pakai container)

## Langkah Instalasi

### 1. Clone Repository ini
```bash
git clone https://github.com/faisalr3za/eventhouse.git
cd eventhouse
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Database
- Pastikan PostgreSQL sudah jalan
- Buat database baru:
  ```sql
  CREATE DATABASE regis_db;
  ```
- Import schema database:
  ```bash
  npm run db:migrate
  ```

### 4. Konfigurasi Environment
- Salin file `.env.example` menjadi `.env`:
  ```bash
  cp .env.example .env
  ```
- Edit file `.env` sesuai konfigurasi kamu (database, email, dll)

### 5. Jalankan Aplikasi

**Mode Development:**
```bash
npm run dev
```

**Mode Production:**
```bash
npm start
```

**Pakai Docker:**
```bash
docker-compose up -d
```

### 6. Akses Aplikasi
- Frontend: `http://localhost:3000`
- Admin Panel: `http://localhost:3000/admin`

## Perintah Berguna

```bash
# Testing
npm test                 # Run tests
npm run test:watch      # Run tests in watch mode

# Code Quality
npm run lint            # Check code style
npm run format          # Format code

# Database
npm run db:reset        # Reset database
npm run db:seed         # Seed sample data

# Docker
npm run docker:build    # Build Docker image
npm run docker:run      # Run with Docker
npm run docker:stop     # Stop Docker containers
```

## Troubleshooting

**Port sudah dipakai?**
- Ganti port di file `.env` (PORT=3001)

**Database connection error?**
- Pastikan PostgreSQL jalan
- Cek konfigurasi database di `.env`

**Module not found?**
- Hapus `node_modules` dan install ulang:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

## Fitur Utama
- 📋 Sistem registrasi event
- 🔐 QR Code check-in system
- 💳 Payment gateway (Midtrans & Xendit)
- 👨‍💼 Admin dashboard
- 📱 Mobile-friendly
- 🔒 Security features

## Kontribusi
Kalau mau kontribusi atau ada bug, silakan buat issue atau pull request ya!

Selamat mencoba! Semoga lancar dan sukses! 🚀
