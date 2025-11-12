#!/bin/bash

# ==============================================================================
# LIZDEIKA - VM DEPLOYMENT SCRIPT
# ==============================================================================
# One-command deployment for VMs using Docker
# Usage: ./scripts/deploy.sh [production|development]
#
# Prerequisites:
# - Docker and Docker Compose installed
# - .env file configured (copy from .env.template)
# ==============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default deployment mode
DEPLOY_MODE="${1:-development}"

echo -e "${BLUE}===============================================================================${NC}"
echo -e "${BLUE}🚀 LIZDEIKA DEPLOYMENT${NC}"
echo -e "${BLUE}===============================================================================${NC}"
echo -e "Deployment mode: ${YELLOW}${DEPLOY_MODE}${NC}"
echo

# Function to log messages
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Function to check environment configuration
check_environment() {
    log_info "Checking environment configuration..."

    if [ "$DEPLOY_MODE" = "production" ]; then
        if [ ! -f ".env.docker.local" ]; then
            log_warning ".env.docker.local not found. Creating from template..."
            if [ -f ".env.docker" ]; then
                cp .env.docker .env.docker.local
                log_warning "Please edit .env.docker.local with your production values before continuing"
                log_info "Required variables: OPENROUTER_API_KEY, JWT_SECRET, JWT_REFRESH_SECRET, DB_PASSWORD"
                echo
                read -p "Press Enter after configuring .env.docker.local..."
            else
                log_error ".env.docker template not found. Please create environment configuration."
                exit 1
            fi
        fi
    else
        if [ ! -f ".env" ]; then
            log_warning ".env not found. Creating from template..."
            if [ -f ".env.template" ]; then
                cp .env.template .env
                log_warning "Please edit .env with your configuration before continuing"
                log_info "Required variables: OPENROUTER_API_KEY, MISTRAL_API_KEY, CHROMA_* settings"
                echo
                read -p "Press Enter after configuring .env..."
            else
                log_error ".env.template not found. Please create environment configuration."
                exit 1
            fi
        fi
    fi

    log_success "Environment configuration check passed"
}

# Function to check port availability
check_ports() {
    log_info "Checking port availability..."

    local required_ports=("3002" "5434")

    for port in "${required_ports[@]}"; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
            log_warning "Port $port is already in use"
            log_info "Attempting to stop conflicting services..."

            # Try to stop any running containers that might be using the port
            docker-compose down 2>/dev/null || true

            # Check again
            if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
                log_error "Port $port is still in use. Please free the port and try again."
                log_info "You can find what's using the port with: lsof -i :$port"
                exit 1
            fi
        fi
    done

    log_success "Port availability check passed"
}

# Function to clean up old containers and images
cleanup_old_deployment() {
    log_info "Cleaning up old deployment..."

    # Stop and remove containers
    docker-compose down --remove-orphans 2>/dev/null || true

    if [ "$DEPLOY_MODE" = "production" ]; then
        docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
    fi

    # Remove unused images (optional)
    if [ "$DEPLOY_MODE" = "production" ]; then
        log_info "Removing unused Docker images..."
        docker image prune -f || true
    fi

    log_success "Cleanup completed"
}

# Function to build and deploy
deploy_application() {
    log_info "Starting application deployment..."

    if [ "$DEPLOY_MODE" = "production" ]; then
        log_info "Building production containers..."
        docker-compose -f docker-compose.prod.yml build --no-cache

        log_info "Starting production services..."
        docker-compose -f docker-compose.prod.yml up -d

        # Wait for services to be ready
        log_info "Waiting for services to start..."
        sleep 15

        # Run database migrations
        log_info "Running database migrations..."
        docker-compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy

        # Seed database if needed
        log_info "Seeding database..."
        docker-compose -f docker-compose.prod.yml exec -T backend npm run db:seed || log_warning "Database seeding failed (might already be seeded)"

    else
        log_info "Building development containers..."
        docker-compose build --no-cache

        log_info "Starting development services..."
        docker-compose up -d

        # Wait for services to be ready
        log_info "Waiting for services to start..."
        sleep 15

        # Run database migrations
        log_info "Running database migrations..."
        docker-compose exec -T backend npx prisma migrate dev --name deployment || docker-compose exec -T backend npx prisma db push

        # Seed database
        log_info "Seeding database..."
        docker-compose exec -T backend npm run db:seed || log_warning "Database seeding failed (might already be seeded)"
    fi

    log_success "Application deployment completed"
}

# Function to verify deployment
verify_deployment() {
    log_info "Verifying deployment..."

    local base_url="http://localhost:3002"
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$base_url/health" > /dev/null; then
            log_success "Health check passed"
            break
        fi

        attempt=$((attempt + 1))
        log_info "Waiting for application to be ready... (attempt $attempt/$max_attempts)"
        sleep 2
    done

    if [ $attempt -eq $max_attempts ]; then
        log_error "Application failed to start properly"
        log_info "Checking container logs..."

        if [ "$DEPLOY_MODE" = "production" ]; then
            docker-compose -f docker-compose.prod.yml logs backend
        else
            docker-compose logs backend
        fi
        exit 1
    fi

    # Test main endpoints
    log_info "Testing application endpoints..."

    local endpoints=(
        "$base_url"
        "$base_url/agent-dashboard.html"
        "$base_url/settings.html"
        "$base_url/health"
    )

    for endpoint in "${endpoints[@]}"; do
        if curl -s -o /dev/null -w "%{http_code}" "$endpoint" | grep -q "200\|302"; then
            log_success "✓ $endpoint"
        else
            log_warning "✗ $endpoint (might be expected for protected routes)"
        fi
    done
}

# Function to show deployment summary
show_deployment_summary() {
    echo
    echo -e "${GREEN}===============================================================================${NC}"
    echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL${NC}"
    echo -e "${GREEN}===============================================================================${NC}"
    echo
    echo -e "${BLUE}Application URLs:${NC}"
    echo -e "  🌐 Main Application:     http://localhost:3002"
    echo -e "  👨‍💼 Agent Dashboard:       http://localhost:3002/agent-dashboard.html"
    echo -e "  ⚙️  Settings/Admin:       http://localhost:3002/settings.html"
    echo -e "  🔑 Login:                http://localhost:3002/login.html"
    echo -e "  📖 API Documentation:   http://localhost:3002/docs"
    echo -e "  💚 Health Check:        http://localhost:3002/health"
    echo
    echo -e "${BLUE}Default Admin Credentials:${NC}"
    echo -e "  📧 Email:    admin@lizdeika.lt"
    echo -e "  🔒 Password: admin123"
    echo
    echo -e "${BLUE}Useful Commands:${NC}"
    if [ "$DEPLOY_MODE" = "production" ]; then
        echo -e "  📊 View logs:           docker-compose -f docker-compose.prod.yml logs -f"
        echo -e "  🔄 Restart:             docker-compose -f docker-compose.prod.yml restart"
        echo -e "  🛑 Stop:                docker-compose -f docker-compose.prod.yml down"
    else
        echo -e "  📊 View logs:           docker-compose logs -f"
        echo -e "  🔄 Restart:             docker-compose restart"
        echo -e "  🛑 Stop:                docker-compose down"
    fi
    echo -e "  🗄️  Database CLI:        docker-compose exec postgres psql -U lizdeika_user -d lizdeika_support"
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo -e "  1. 🌐 Visit http://localhost:3002 to test the application"
    echo -e "  2. 🔑 Login with admin credentials to access settings"
    echo -e "  3. 📚 Upload documents in Knowledge Management"
    echo -e "  4. 🤖 Configure AI providers in System Settings"
    echo -e "  5. 👥 Create agent accounts for your team"
    echo
}

# Main deployment flow
main() {
    echo
    check_prerequisites
    echo
    check_environment
    echo
    check_ports
    echo
    cleanup_old_deployment
    echo
    deploy_application
    echo
    verify_deployment
    echo
    show_deployment_summary
}

# Handle script interruption
trap 'log_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main

log_success "Deployment script completed successfully!"