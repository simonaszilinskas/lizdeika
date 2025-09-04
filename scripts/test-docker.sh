#!/bin/bash

echo "🐳 Testing Docker Setup..."
echo "========================="

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    exit 1
fi
echo "✅ Docker is running"

# Check if docker-compose is available
if ! docker-compose version > /dev/null 2>&1; then
    echo "❌ Docker Compose is not available!"
    exit 1
fi
echo "✅ Docker Compose is available"

# Check for port conflicts
echo ""
echo "📋 Checking for port conflicts..."
if lsof -i :3002 > /dev/null 2>&1; then
    echo "⚠️  Port 3002 is already in use (backend)"
else
    echo "✅ Port 3002 is available"
fi

if lsof -i :5434 > /dev/null 2>&1; then
    echo "⚠️  Port 5434 is already in use (postgres)"
else
    echo "✅ Port 5434 is available"
fi

# Create a minimal test environment file
echo ""
echo "📝 Creating test environment file..."
cat > .env.docker.local <<EOF
OPENROUTER_API_KEY=test-key-for-docker-build
EOF
echo "✅ Created .env.docker.local"

# Test docker-compose config
echo ""
echo "🔍 Validating docker-compose configuration..."
if docker-compose config > /dev/null 2>&1; then
    echo "✅ Docker Compose configuration is valid"
else
    echo "❌ Docker Compose configuration has errors!"
    docker-compose config
    exit 1
fi

echo ""
echo "✨ Docker setup appears to be working correctly!"
echo ""
echo "To start the application:"
echo "  docker-compose up -d"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"