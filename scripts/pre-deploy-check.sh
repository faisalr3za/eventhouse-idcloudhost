#!/bin/bash

# Pre-deployment Performance Check Script
# Memastikan semua konfigurasi optimal sebelum deploy ke production

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 EventHouse by IDCloudHost Pre-Deployment Performance Check"
echo "=============================================="

ISSUES=0

# Function to check system requirements
check_system() {
    echo -e "\n📋 System Requirements Check:"
    
    # Check RAM
    TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_RAM" -ge 4 ]; then
        echo -e "  ✅ RAM: ${TOTAL_RAM}GB (Recommended: 4GB+)"
    else
        echo -e "  ❌ RAM: ${TOTAL_RAM}GB (Need at least 4GB for production)"
        ISSUES=$((ISSUES + 1))
    fi
    
    # Check CPU cores
    CPU_CORES=$(nproc)
    if [ "$CPU_CORES" -ge 2 ]; then
        echo -e "  ✅ CPU Cores: $CPU_CORES (Recommended: 2+)"
    else
        echo -e "  ⚠️  CPU Cores: $CPU_CORES (Recommended: 2+ for better performance)"
    fi
    
    # Check disk space
    DISK_SPACE=$(df -h / | awk 'NR==2{print $4}' | sed 's/G//' | cut -d'.' -f1)
    if [ "$DISK_SPACE" -ge 10 ]; then
        echo -e "  ✅ Disk Space: ${DISK_SPACE}GB available"
    else
        echo -e "  ❌ Disk Space: ${DISK_SPACE}GB available (Need at least 10GB)"
        ISSUES=$((ISSUES + 1))
    fi
}

# Function to check Docker configuration
check_docker() {
    echo -e "\n🐳 Docker Configuration Check:"
    
    # Check if Docker is installed
    if command -v docker &> /dev/null; then
        echo -e "  ✅ Docker installed: $(docker --version | cut -d' ' -f3 | sed 's/,//')"
        
        # Check Docker daemon limits
        if [ -f "/etc/docker/daemon.json" ]; then
            echo -e "  ✅ Docker daemon.json exists"
            
            # Check ulimits in daemon.json
            if grep -q "default-ulimits" /etc/docker/daemon.json; then
                echo -e "  ✅ Docker ulimits configured"
            else
                echo -e "  ⚠️  Docker ulimits not configured (performance may be limited)"
            fi
        else
            echo -e "  ⚠️  Docker daemon.json not found (using defaults)"
        fi
    else
        echo -e "  ❌ Docker not installed"
        ISSUES=$((ISSUES + 1))
    fi
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        echo -e "  ✅ Docker Compose installed: $(docker-compose --version | cut -d' ' -f3 | sed 's/,//')"
    else
        echo -e "  ❌ Docker Compose not installed"
        ISSUES=$((ISSUES + 1))
    fi
}

# Function to check system limits
check_limits() {
    echo -e "\n⚙️  System Limits Check:"
    
    # Check file descriptor limits
    CURRENT_NOFILE=$(ulimit -n)
    if [ "$CURRENT_NOFILE" -ge 65536 ]; then
        echo -e "  ✅ File descriptors: $CURRENT_NOFILE (Recommended: 65536+)"
    else
        echo -e "  ⚠️  File descriptors: $CURRENT_NOFILE (Recommended: 65536+)"
        echo -e "     Run: echo '* soft nofile 65536' | sudo tee -a /etc/security/limits.conf"
    fi
    
    # Check process limits
    CURRENT_NPROC=$(ulimit -u)
    if [ "$CURRENT_NPROC" -ge 32768 ]; then
        echo -e "  ✅ Process limit: $CURRENT_NPROC (Recommended: 32768+)"
    else
        echo -e "  ⚠️  Process limit: $CURRENT_NPROC (Recommended: 32768+)"
    fi
    
    # Check max connections
    if [ -f "/proc/sys/net/core/somaxconn" ]; then
        SOMAXCONN=$(cat /proc/sys/net/core/somaxconn)
        if [ "$SOMAXCONN" -ge 4096 ]; then
            echo -e "  ✅ Max connections: $SOMAXCONN (Recommended: 4096+)"
        else
            echo -e "  ⚠️  Max connections: $SOMAXCONN (Recommended: 4096+)"
            echo -e "     Run: echo 'net.core.somaxconn = 65535' | sudo tee -a /etc/sysctl.conf"
        fi
    fi
}

# Function to check required files
check_files() {
    echo -e "\n📁 Required Files Check:"
    
    REQUIRED_FILES=(
        ".env"
        "database/saas-schema.sql"
        "docker-compose.prod.yml"
        "Dockerfile.prod"
        "nginx/nginx.conf"
    )
    
    for file in "${REQUIRED_FILES[@]}"; do
        if [ -f "$file" ]; then
            echo -e "  ✅ $file exists"
        else
            echo -e "  ❌ $file missing"
            ISSUES=$((ISSUES + 1))
        fi
    done
    
    # Check environment variables
    if [ -f ".env" ]; then
        REQUIRED_VARS=(
            "DB_PASSWORD"
            "REDIS_PASSWORD"
            "JWT_SECRET"
            "SESSION_SECRET"
            "EMAIL_USER"
            "EMAIL_PASS"
        )
        
        for var in "${REQUIRED_VARS[@]}"; do
            if grep -q "^$var=" .env && ! grep -q "^$var=$" .env; then
                echo -e "  ✅ $var configured"
            else
                echo -e "  ❌ $var not configured or empty"
                ISSUES=$((ISSUES + 1))
            fi
        done
    fi
}

# Function to check network settings
check_network() {
    echo -e "\n🌐 Network Configuration Check:"
    
    # Check TCP settings
    if [ -f "/proc/sys/net/ipv4/tcp_tw_reuse" ]; then
        TCP_REUSE=$(cat /proc/sys/net/ipv4/tcp_tw_reuse)
        if [ "$TCP_REUSE" = "1" ]; then
            echo -e "  ✅ TCP TIME_WAIT reuse enabled"
        else
            echo -e "  ⚠️  TCP TIME_WAIT reuse disabled (may limit connections)"
        fi
    fi
    
    # Check firewall status
    if command -v ufw &> /dev/null; then
        UFW_STATUS=$(ufw status | head -1 | awk '{print $2}')
        if [ "$UFW_STATUS" = "active" ]; then
            echo -e "  ✅ UFW firewall active"
            
            # Check if required ports are open
            if ufw status | grep -q "80\|443"; then
                echo -e "  ✅ HTTP/HTTPS ports open"
            else
                echo -e "  ❌ HTTP/HTTPS ports not open"
                echo -e "     Run: sudo ufw allow 80 && sudo ufw allow 443"
                ISSUES=$((ISSUES + 1))
            fi
        else
            echo -e "  ⚠️  UFW firewall inactive"
        fi
    fi
}

# Function to check security
check_security() {
    echo -e "\n🔒 Security Check:"
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
        echo -e "  ⚠️  Running as root (not recommended for production)"
    else
        echo -e "  ✅ Running as non-root user"
    fi
    
    # Check for strong passwords
    if [ -f ".env" ]; then
        # Check password length
        DB_PASS_LEN=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2 | wc -c)
        if [ "$DB_PASS_LEN" -ge 16 ]; then
            echo -e "  ✅ Database password length adequate"
        else
            echo -e "  ⚠️  Database password too short (recommended: 16+ characters)"
        fi
        
        JWT_SECRET_LEN=$(grep "^JWT_SECRET=" .env | cut -d'=' -f2 | wc -c)
        if [ "$JWT_SECRET_LEN" -ge 32 ]; then
            echo -e "  ✅ JWT secret length adequate"
        else
            echo -e "  ❌ JWT secret too short (required: 32+ characters)"
            ISSUES=$((ISSUES + 1))
        fi
    fi
}

# Function to test Docker build
test_docker_build() {
    echo -e "\n🔨 Docker Build Test:"
    
    echo -e "  🔄 Testing production Docker build..."
    if docker build -t eventhouse-test -f Dockerfile.prod . > /dev/null 2>&1; then
        echo -e "  ✅ Docker build successful"
        
        # Clean up test image
        docker rmi eventhouse-test > /dev/null 2>&1
    else
        echo -e "  ❌ Docker build failed"
        ISSUES=$((ISSUES + 1))
    fi
}

# Function to validate configuration files
validate_configs() {
    echo -e "\n📋 Configuration Validation:"
    
    # Validate docker-compose.prod.yml
    if [ -f "docker-compose.prod.yml" ]; then
        if docker-compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
            echo -e "  ✅ docker-compose.prod.yml valid"
        else
            echo -e "  ❌ docker-compose.prod.yml invalid"
            ISSUES=$((ISSUES + 1))
        fi
    fi
    
    # Validate nginx configuration
    if [ -f "nginx/nginx.conf" ]; then
        if docker run --rm -v "$PWD/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:alpine nginx -t > /dev/null 2>&1; then
            echo -e "  ✅ nginx.conf valid"
        else
            echo -e "  ❌ nginx.conf invalid"
            ISSUES=$((ISSUES + 1))
        fi
    fi
}

# Function to check performance settings
check_performance() {
    echo -e "\n⚡ Performance Settings Check:"
    
    # Check CPU governor
    if [ -f "/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor" ]; then
        GOVERNOR=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor)
        if [ "$GOVERNOR" = "performance" ]; then
            echo -e "  ✅ CPU governor: $GOVERNOR"
        else
            echo -e "  ⚠️  CPU governor: $GOVERNOR (recommended: performance)"
        fi
    fi
    
    # Check I/O scheduler
    if [ -f "/sys/block/sda/queue/scheduler" ]; then
        SCHEDULER=$(cat /sys/block/sda/queue/scheduler | grep -o '\[.*\]' | tr -d '[]')
        if [ "$SCHEDULER" = "mq-deadline" ] || [ "$SCHEDULER" = "deadline" ]; then
            echo -e "  ✅ I/O scheduler: $SCHEDULER"
        else
            echo -e "  ⚠️  I/O scheduler: $SCHEDULER (recommended: mq-deadline for SSD)"
        fi
    fi
    
    # Check swappiness
    SWAPPINESS=$(cat /proc/sys/vm/swappiness)
    if [ "$SWAPPINESS" -le 10 ]; then
        echo -e "  ✅ Swappiness: $SWAPPINESS (recommended: ≤10)"
    else
        echo -e "  ⚠️  Swappiness: $SWAPPINESS (recommended: ≤10 for databases)"
    fi
}

# Run all checks
check_system
check_docker
check_limits
check_files
check_network
check_security
test_docker_build
validate_configs
check_performance

# Summary
echo -e "\n📊 Summary:"
echo "============"

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Your system is ready for production deployment.${NC}"
    echo ""
    echo "🚀 Next steps:"
    echo "  1. Review your .env configuration"
    echo "  2. Test with: docker-compose -f docker-compose.prod.yml up -d"
    echo "  3. Monitor with: docker-compose -f docker-compose.prod.yml logs -f"
    echo "  4. Check health: curl http://localhost/health"
    exit 0
else
    echo -e "${RED}❌ Found $ISSUES issue(s) that need attention before deployment.${NC}"
    echo ""
    echo "🔧 Please fix the issues above and run this script again."
    exit 1
fi
