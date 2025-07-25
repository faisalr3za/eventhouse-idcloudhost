# 🚀 VM Performance Tuning untuk High Concurrency

Panduan lengkap untuk mengoptimalkan performance VM di IDCloudHost untuk aplikasi EventHouse by IDCloudHost yang high concurrency.

## 📊 Spesifikasi Recommended

### Production-Ready Specs:
| Users | vCPU | RAM | Storage | Network | Est. Budget/bulan |
|-------|------|-----|---------|---------|------------------|
| 1K-5K | 4 vCPU | 8GB | 100GB SSD | 100Mbps | ~Rp 400K |
| 5K-15K | 8 vCPU | 16GB | 200GB SSD | 500Mbps | ~Rp 800K |
| 15K-50K | 16 vCPU | 32GB | 500GB SSD | 1Gbps | ~Rp 1.5M |
| 50K+ | 32 vCPU | 64GB | 1TB SSD | 1Gbps+ | ~Rp 3M |

## 🔧 System-Level Optimizations

### 1. Kernel Parameters (sysctl)
```bash
# Create optimized sysctl configuration
sudo nano /etc/sysctl.d/99-performance.conf
```

**Performance Configuration:**
```bash
# Network Performance
net.core.rmem_default = 262144
net.core.rmem_max = 16777216
net.core.wmem_default = 262144
net.core.wmem_max = 16777216
net.core.netdev_max_backlog = 5000
net.core.netdev_budget = 600
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.tcp_congestion_control = bbr
net.ipv4.tcp_fastopen = 3
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_max_tw_buckets = 2000000
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_mtu_probing = 1

# Connection Tracking
net.netfilter.nf_conntrack_max = 524288
net.netfilter.nf_conntrack_tcp_timeout_established = 300
net.netfilter.nf_conntrack_tcp_timeout_time_wait = 30
net.netfilter.nf_conntrack_tcp_timeout_close_wait = 15
net.netfilter.nf_conntrack_tcp_timeout_fin_wait = 15

# File System
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 256

# Virtual Memory
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
vm.vfs_cache_pressure = 50
vm.overcommit_memory = 1

# Process/Thread Limits
kernel.pid_max = 4194304
kernel.threads-max = 4194304

# Apply changes
sudo sysctl -p /etc/sysctl.d/99-performance.conf
```

### 2. System Limits Configuration
```bash
# Configure system limits
sudo nano /etc/security/limits.conf
```

**Add these limits:**
```bash
# User limits for high concurrency
* soft nofile 1048576
* hard nofile 1048576
* soft nproc 1048576
* hard nproc 1048576
* soft memlock unlimited
* hard memlock unlimited

# Docker/Deploy user specific
deploy soft nofile 1048576
deploy hard nofile 1048576
deploy soft nproc 1048576
deploy hard nproc 1048576

root soft nofile 1048576
root hard nofile 1048576
```

```bash
# Configure systemd limits
sudo nano /etc/systemd/system.conf
```

**Add/modify:**
```bash
DefaultLimitNOFILE=1048576
DefaultLimitNPROC=1048576
DefaultLimitCORE=infinity
DefaultLimitMEMLOCK=infinity
```

```bash
# Configure PAM limits
sudo nano /etc/pam.d/common-session
# Add: session required pam_limits.so

# Reload systemd
sudo systemctl daemon-reload

# Reboot to apply all changes
sudo reboot
```

### 3. CPU Governor & Frequency Scaling
```bash
# Install CPU frequency utilities
sudo apt install -y cpufrequtils

# Set performance governor
echo 'GOVERNOR="performance"' | sudo tee /etc/default/cpufrequtils

# Apply immediately
sudo cpufreq-set -g performance

# Verify
cpufreq-info
```

### 4. I/O Scheduler Optimization
```bash
# Check current I/O scheduler
cat /sys/block/sda/queue/scheduler

# Set mq-deadline for SSD (better for databases)
echo mq-deadline | sudo tee /sys/block/sda/queue/scheduler

# Make permanent
echo 'ACTION=="add|change", KERNEL=="sda", ATTR{queue/scheduler}="mq-deadline"' | sudo tee /etc/udev/rules.d/60-scheduler.rules
```

## 🐳 Docker Performance Tuning

### 1. Docker Daemon Configuration
```bash
# Configure Docker daemon
sudo nano /etc/docker/daemon.json
```

**Docker Configuration:**
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ],
  "default-ulimits": {
    "nofile": {
      "Hard": 1048576,
      "Name": "nofile",
      "Soft": 1048576
    },
    "nproc": {
      "Hard": 1048576,
      "Name": "nproc", 
      "Soft": 1048576
    }
  },
  "max-concurrent-downloads": 10,
  "max-concurrent-uploads": 10,
  "experimental": false,
  "metrics-addr": "127.0.0.1:9323",
  "live-restore": true
}
```

```bash
sudo systemctl restart docker
```

### 2. Optimized Production Docker Compose
```bash
# Create optimized production compose
nano docker-compose.prod.yml
```

**High Performance Docker Compose:**
```yaml
version: '3.8'

services:
  # PostgreSQL with performance tuning
  postgres:
    image: postgres:15-alpine
    container_name: eventhouse_postgres
    restart: unless-stopped
    shm_size: 1gb  # Increased shared memory
    environment:
      POSTGRES_DB: regis_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/saas-schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./postgres/postgresql.conf:/etc/postgresql/postgresql.conf
      - ./backups:/backups
    command: >
      postgres
      -c shared_preload_libraries=pg_stat_statements
      -c pg_stat_statements.track=all
      -c max_connections=400
      -c shared_buffers=2GB
      -c effective_cache_size=6GB
      -c work_mem=32MB
      -c maintenance_work_mem=512MB
      -c wal_buffers=64MB
      -c checkpoint_completion_target=0.9
      -c random_page_cost=1.1
      -c effective_io_concurrency=200
      -c max_worker_processes=16
      -c max_parallel_workers_per_gather=4
      -c max_parallel_workers=16
      -c max_parallel_maintenance_workers=4
      -c logging_collector=on
      -c log_min_duration_statement=1000
      -c log_checkpoints=on
      -c log_lock_waits=on
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '4'
        reservations:
          memory: 2G
          cpus: '2'
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
    networks:
      - eventhouse_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d regis_db"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # Redis with performance tuning
  redis:
    image: redis:7-alpine
    container_name: eventhouse_redis
    restart: unless-stopped
    sysctls:
      - net.core.somaxconn=65535
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --appendonly yes
      --appendfsync everysec
      --maxmemory 1gb
      --maxmemory-policy allkeys-lru
      --tcp-keepalive 60
      --timeout 300
      --tcp-backlog 65535
      --databases 16
      --save 900 1
      --save 300 10
      --save 60 10000
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '2'
        reservations:
          memory: 512M
          cpus: '1'
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
    networks:
      - eventhouse_network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Node.js Application with performance tuning
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    container_name: eventhouse_app
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - UV_THREADPOOL_SIZE=16
      - NODE_OPTIONS=--max-old-space-size=4096 --max-semi-space-size=128
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=regis_db
      - DB_USER=postgres
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - EMAIL_HOST=${EMAIL_HOST}
      - EMAIL_PORT=${EMAIL_PORT}
      - EMAIL_USER=${EMAIL_USER}
      - EMAIL_PASS=${EMAIL_PASS}
      - EMAIL_FROM=${EMAIL_FROM}
      - APP_URL=${APP_URL}
      - SESSION_SECRET=${SESSION_SECRET}
      - LOG_LEVEL=warn
    volumes:
      - ./public/assets:/app/public/assets
      - ./logs:/app/logs
    deploy:
      replicas: 4  # Multiple instances for load balancing
      resources:
        limits:
          memory: 2G
          cpus: '2'
        reservations:
          memory: 1G
          cpus: '1'
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
      nproc:
        soft: 65536
        hard: 65536
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - eventhouse_network
    healthcheck:
      test: ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

  # Nginx with high performance configuration
  nginx:
    image: nginx:alpine
    container_name: eventhouse_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./public:/var/www/html:ro
      - /var/log/nginx:/var/log/nginx
      - nginx_cache:/var/cache/nginx
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '2'
        reservations:
          memory: 512M
          cpus: '1'
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
    depends_on:
      - app
    networks:
      - eventhouse_network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  nginx_cache:
    driver: local

networks:
  eventhouse_network:
    driver: bridge
    driver_opts:
      com.docker.network.driver.mtu: 1500
```

### 3. Optimized Production Dockerfile
```bash
nano Dockerfile.prod
```

**High Performance Dockerfile:**
```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache tini curl wget && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy node_modules from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create necessary directories and set permissions
RUN mkdir -p public/assets/qr-codes logs && \
    chown -R nodejs:nodejs public/assets logs && \
    chmod -R 755 public/assets

# Expose port
EXPOSE 3000

# Use nodejs user for security
USER nodejs

# Use tini as init system (handles zombie processes)
ENTRYPOINT ["/sbin/tini", "--"]

# Start application with cluster mode
CMD ["node", "--max-old-space-size=1024", "src/cluster.js"]
```

### 4. Node.js Cluster Mode
```bash
# Create cluster implementation
nano src/cluster.js
```

**Cluster Configuration:**
```javascript
const cluster = require('cluster');
const os = require('os');
const logger = require('./utils/logger');

const numCPUs = process.env.NODE_CLUSTER_WORKERS || os.cpus().length;

if (cluster.isMaster) {
    console.log(`🚀 Master process ${process.pid} is running`);
    console.log(`🔧 Starting ${numCPUs} worker processes...`);
    
    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    
    // Handle worker exit
    cluster.on('exit', (worker, code, signal) => {
        logger.error(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
        logger.info('Starting a new worker...');
        cluster.fork();
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
        logger.info('Master received SIGTERM, shutting down gracefully...');
        
        for (const worker of Object.values(cluster.workers)) {
            worker.send('shutdown');
        }
        
        setTimeout(() => {
            logger.info('Forcefully shutting down...');
            process.exit(1);
        }, 10000);
    });
    
} else {
    // Worker process
    const app = require('./app');
    console.log(`👷 Worker ${process.pid} started`);
    
    // Graceful shutdown for worker
    process.on('message', (msg) => {
        if (msg === 'shutdown') {
            logger.info(`Worker ${process.pid} shutting down...`);
            process.exit(0);
        }
    });
}
```

## 🔧 High Performance Nginx Configuration

```bash
nano nginx/nginx.conf
```

**Ultra High Performance Nginx:**
```nginx
# Optimize for high concurrency
user nginx;
worker_processes auto;
worker_rlimit_nofile 65535;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 8192;
    use epoll;
    multi_accept on;
    accept_mutex off;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logging optimized
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                   '$status $body_bytes_sent "$http_referer" '
                   '"$http_user_agent" "$http_x_forwarded_for" '
                   'rt=$request_time uct="$upstream_connect_time" '
                   'uht="$upstream_header_time" urt="$upstream_response_time"';
    
    access_log /var/log/nginx/access.log main buffer=256k flush=5s;
    
    # Performance settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    keepalive_requests 10000;
    types_hash_max_size 2048;
    server_tokens off;
    
    # Buffer sizes
    client_body_buffer_size 16k;
    client_header_buffer_size 1k;
    client_max_body_size 16m;
    large_client_header_buffers 4 8k;
    
    # Timeouts
    client_body_timeout 12;
    client_header_timeout 12;
    send_timeout 10;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json
        image/svg+xml;
    
    # Brotli compression (if available)
    # brotli on;
    # brotli_comp_level 6;
    # brotli_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=10r/m;
    limit_req_zone $binary_remote_addr zone=register:10m rate=5r/m;
    
    # Connection limiting
    limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
    
    # Cache zones
    proxy_cache_path /var/cache/nginx/api levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m use_temp_path=off;
    proxy_cache_path /var/cache/nginx/static levels=1:2 keys_zone=static_cache:10m max_size=2g inactive=30d use_temp_path=off;
    
    # Load balancing upstream
    upstream app_backend {
        least_conn;
        server app:3000 max_fails=3 fail_timeout=30s;
        # Add more app instances if using multiple containers
        keepalive 64;
        keepalive_requests 10000;
        keepalive_timeout 60s;
    }
    
    # Rate limiting map
    map $request_uri $limit_rate_key {
        ~*/api/auth/     $binary_remote_addr;
        ~*/api/register  $binary_remote_addr;
        default          "";
    }
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # HTTP/2 Server Push
    http2_push_preload on;
    
    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Main server configuration
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;
        
        # SSL certificates
        ssl_certificate /etc/nginx/ssl/yourdomain.com.crt;
        ssl_certificate_key /etc/nginx/ssl/yourdomain.com.key;
        
        # Connection limits
        limit_conn conn_limit_per_ip 50;
        
        # Static files with aggressive caching
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header Vary Accept-Encoding;
            
            # Enable compression
            gzip_static on;
            
            # Try static cache first
            try_files $uri @app_backend;
        }
        
        # API endpoints with caching and rate limiting
        location /api/ {
            # Rate limiting
            limit_req zone=api burst=200 nodelay;
            
            # Proxy settings
            proxy_pass http://app_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Buffering
            proxy_buffering on;
            proxy_buffer_size 128k;
            proxy_buffers 4 256k;
            proxy_busy_buffers_size 256k;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # Cache certain API responses
            proxy_cache api_cache;
            proxy_cache_valid 200 5m;
            proxy_cache_valid 404 1m;
            proxy_cache_use_stale error timeout invalid_header updating;
            proxy_cache_background_update on;
            proxy_cache_lock on;
            
            # Skip cache for auth endpoints
            proxy_cache_bypass $arg_nocache $cookie_nocache $arg_comment;
            proxy_no_cache $arg_nocache $cookie_nocache $arg_comment;
        }
        
        # Authentication endpoints with strict rate limiting
        location /api/auth/ {
            limit_req zone=login burst=10 nodelay;
            proxy_pass http://app_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # No caching for auth
            proxy_cache off;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
        
        # Registration endpoints
        location /api/register {
            limit_req zone=register burst=10 nodelay;
            proxy_pass http://app_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Health check (no rate limiting)
        location /health {
            proxy_pass http://app_backend;
            access_log off;
            proxy_cache off;
        }
        
        # All other requests
        location / {
            limit_req zone=api burst=100 nodelay;
            proxy_pass http://app_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Basic caching for HTML pages
            proxy_cache api_cache;
            proxy_cache_valid 200 1m;
            proxy_cache_use_stale error timeout invalid_header updating;
        }
        
        # Named location for app backend
        location @app_backend {
            proxy_pass http://app_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    
    # HTTP redirect to HTTPS
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        
        # Health check without redirect
        location /health {
            proxy_pass http://app_backend;
            access_log off;
        }
        
        # Redirect all other traffic to HTTPS
        location / {
            return 301 https://$server_name$request_uri;
        }
    }
}
```

## 🗄️ PostgreSQL Performance Tuning

```bash
# Create PostgreSQL configuration
mkdir -p postgres
nano postgres/postgresql.conf
```

**High Performance PostgreSQL Config:**
```ini
# PostgreSQL High Performance Configuration
# For 8GB RAM, 4 vCPU server

# Connection Settings
max_connections = 400
superuser_reserved_connections = 3

# Memory Settings
shared_buffers = 2GB                    # 25% of RAM
effective_cache_size = 6GB              # 75% of RAM
work_mem = 32MB                         # (Total RAM - shared_buffers) / max_connections
maintenance_work_mem = 512MB            # 1/8 of RAM
temp_buffers = 32MB

# WAL Settings
wal_buffers = 64MB
checkpoint_completion_target = 0.9
checkpoint_timeout = 15min
max_wal_size = 4GB
min_wal_size = 1GB
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backups/wal/%f'

# Query Planner
random_page_cost = 1.1                  # For SSD
effective_io_concurrency = 200          # For SSD
seq_page_cost = 1.0
cpu_tuple_cost = 0.01
cpu_index_tuple_cost = 0.005
cpu_operator_cost = 0.0025

# Parallel Query
max_worker_processes = 16
max_parallel_workers_per_gather = 4
max_parallel_workers = 16
max_parallel_maintenance_workers = 4
parallel_tuple_cost = 0.1
parallel_setup_cost = 1000.0

# Background Writer
bgwriter_delay = 200ms
bgwriter_lru_maxpages = 100
bgwriter_lru_multiplier = 2.0
bgwriter_flush_after = 512kB

# Auto Vacuum
autovacuum = on
autovacuum_max_workers = 6
autovacuum_naptime = 1min
autovacuum_vacuum_threshold = 50
autovacuum_analyze_threshold = 50
autovacuum_vacuum_scale_factor = 0.1
autovacuum_analyze_scale_factor = 0.05
autovacuum_freeze_max_age = 200000000
autovacuum_multixact_freeze_max_age = 400000000
autovacuum_vacuum_cost_delay = 2ms
autovacuum_vacuum_cost_limit = 400

# Logging
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000       # Log slow queries
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

# Statistics
track_activities = on
track_counts = on
track_io_timing = on
track_functions = all
stats_temp_directory = '/var/run/postgresql/stats_temp'

# Extensions
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000

# Locale
lc_messages = 'en_US.UTF-8'
lc_monetary = 'en_US.UTF-8'
lc_numeric = 'en_US.UTF-8'
lc_time = 'en_US.UTF-8'
default_text_search_config = 'pg_catalog.english'
```

## 📊 Performance Monitoring & Scripts

### 1. Performance Monitoring Script
```bash
nano scripts/monitor-performance.sh
```

**Performance Monitor:**
```bash
#!/bin/bash

LOG_FILE="/var/log/eventhouse-performance.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Performance Check" >> $LOG_FILE

# System load
LOAD=$(uptime | awk -F'load average:' '{ print $2 }')
echo "Load Average: $LOAD" >> $LOG_FILE

# Memory usage
MEMORY=$(free -h | grep '^Mem' | awk '{print $3"/"$2" ("$3/$2*100"%)"'}')
echo "Memory Usage: $MEMORY" >> $LOG_FILE

# Disk I/O
DISK_IO=$(iostat -x 1 1 | grep -E '^(Device|sda)' | tail -1 | awk '{print "Read: "$4" Write: "$5" Util: "$10"%"}')
echo "Disk I/O: $DISK_IO" >> $LOG_FILE

# Network connections
CONNECTIONS=$(ss -s | grep TCP | awk '{print $2}')
echo "TCP Connections: $CONNECTIONS" >> $LOG_FILE

# Docker stats
echo "Docker Container Stats:" >> $LOG_FILE
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" >> $LOG_FILE

# Database connections
DB_CONNECTIONS=$(docker exec eventhouse_postgres psql -U postgres -d regis_db -t -c "SELECT count(*) FROM pg_stat_activity;")
echo "DB Connections: $DB_CONNECTIONS" >> $LOG_FILE

# Check for slow queries
SLOW_QUERIES=$(docker exec eventhouse_postgres psql -U postgres -d regis_db -t -c "SELECT count(*) FROM pg_stat_statements WHERE mean_time > 1000;")
echo "Slow Queries (>1s): $SLOW_QUERIES" >> $LOG_FILE

echo "---" >> $LOG_FILE
```

### 2. Auto-scaling Script
```bash
nano scripts/auto-scale.sh
```

**Simple Auto-scaler:**
```bash
#!/bin/bash

# Get current CPU usage
CPU_USAGE=$(docker stats --no-stream --format "{{.CPUPerc}}" eventhouse_app | head -1 | sed 's/%//')
MEMORY_USAGE=$(docker stats --no-stream --format "{{.MemPerc}}" eventhouse_app | head -1 | sed 's/%//')

# Current replica count
CURRENT_REPLICAS=$(docker service ls --filter name=eventhouse_app --format "{{.Replicas}}" | cut -d'/' -f1)

# Scale up if CPU > 80% or Memory > 85%
if (( $(echo "$CPU_USAGE > 80" | bc -l) )) || (( $(echo "$MEMORY_USAGE > 85" | bc -l) )); then
    if [ "$CURRENT_REPLICAS" -lt 6 ]; then
        NEW_REPLICAS=$((CURRENT_REPLICAS + 1))
        echo "$(date): Scaling UP to $NEW_REPLICAS replicas (CPU: $CPU_USAGE%, MEM: $MEMORY_USAGE%)"
        docker service scale eventhouse_app=$NEW_REPLICAS
    fi
# Scale down if CPU < 30% and Memory < 40%
elif (( $(echo "$CPU_USAGE < 30" | bc -l) )) && (( $(echo "$MEMORY_USAGE < 40" | bc -l) )); then
    if [ "$CURRENT_REPLICAS" -gt 2 ]; then
        NEW_REPLICAS=$((CURRENT_REPLICAS - 1))
        echo "$(date): Scaling DOWN to $NEW_REPLICAS replicas (CPU: $CPU_USAGE%, MEM: $MEMORY_USAGE%)"
        docker service scale eventhouse_app=$NEW_REPLICAS
    fi
fi
```

### 3. Performance Test Script
```bash
nano scripts/performance-test.sh
```

**Load Test:**
```bash
#!/bin/bash

echo "🚀 Starting Performance Test for EventHouse by IDCloudHost"

# Install dependencies if not present
command -v ab >/dev/null 2>&1 || { 
    echo "Installing Apache Bench..."
    sudo apt install -y apache2-utils
}

DOMAIN="https://yourdomain.com"
RESULTS_DIR="performance-results/$(date +%Y%m%d_%H%M%S)"
mkdir -p $RESULTS_DIR

echo "📊 Running load tests..."

# Test 1: Homepage
echo "Testing Homepage..."
ab -n 1000 -c 50 -g "$RESULTS_DIR/homepage.tsv" "$DOMAIN/" > "$RESULTS_DIR/homepage.txt"

# Test 2: Health check
echo "Testing Health Endpoint..."
ab -n 2000 -c 100 -g "$RESULTS_DIR/health.tsv" "$DOMAIN/health" > "$RESULTS_DIR/health.txt"

# Test 3: API endpoint
echo "Testing API Endpoint..."
ab -n 1000 -c 25 -g "$RESULTS_DIR/api.tsv" "$DOMAIN/api/public/events" > "$RESULTS_DIR/api.txt"

# Test 4: Registration form
echo "Testing Registration Form..."
ab -n 500 -c 20 -g "$RESULTS_DIR/register.tsv" "$DOMAIN/register" > "$RESULTS_DIR/register.txt"

echo "✅ Performance tests completed. Results saved in $RESULTS_DIR"
echo "📈 Summary:"
grep "Requests per second" $RESULTS_DIR/*.txt
```

## 🎯 Performance Checklist

**System Level:**
- [ ] Kernel parameters optimized (sysctl)
- [ ] System limits increased (ulimits)
- [ ] CPU governor set to performance
- [ ] I/O scheduler optimized for SSD
- [ ] Swap configured appropriately

**Docker Level:**
- [ ] Docker daemon optimized
- [ ] Container resource limits set
- [ ] Multi-stage builds implemented
- [ ] Cluster mode enabled for Node.js

**Application Level:**
- [ ] Database connection pooling
- [ ] Redis caching implemented
- [ ] Static file caching
- [ ] API response caching
- [ ] Database queries optimized

**Network Level:**
- [ ] Nginx configured for high concurrency
- [ ] HTTP/2 enabled
- [ ] Gzip compression active
- [ ] Rate limiting implemented
- [ ] Load balancing configured

**Monitoring:**
- [ ] Performance monitoring script
- [ ] Health checks implemented
- [ ] Log monitoring setup
- [ ] Alert system configured

---

**Dengan konfigurasi ini, aplikasi EventHouse by IDCloudHost Anda siap menangani high concurrency di IDCloudHost! 🚀**

**Expected Performance:**
- **Concurrent Users**: 10,000+
- **Requests/second**: 1,000+
- **Response Time**: <200ms (95th percentile)
- **Uptime**: 99.9%+
