#!/bin/bash

# Docker Development Script
# Membantu menjalankan aplikasi dalam mode development menggunakan Docker

set -e

echo "🐳 Starting EventHouse by IDCloudHost SaaS with Docker..."

# Create necessary directories
mkdir -p public/assets/qr-codes
mkdir -p logs

# Set permissions
chmod -R 755 public/assets
chmod +x scripts/*.sh

# Build and start services
echo "📦 Building and starting containers..."
docker-compose up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check health
echo "🏥 Checking application health..."
timeout 30 bash -c 'until curl -f http://localhost:3000/health; do sleep 2; done' || {
    echo "❌ Application failed to start properly"
    echo "📝 Checking logs..."
    docker-compose logs app
    exit 1
}

echo "✅ Application is ready!"
echo ""
echo "🌐 Application URLs:"
echo "   Main App:     http://localhost:3000"
echo "   Admin Panel:  http://localhost:3000/admin"  
echo "   Health Check: http://localhost:3000/health"
echo "   pgAdmin:      http://localhost:8080 (admin@eventhouse.idcloudhost.com / admin123)"
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "📝 To view logs:"
echo "   docker-compose logs -f app"
echo ""
echo "🛑 To stop:"
echo "   docker-compose down"
