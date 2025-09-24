#!/bin/bash

# ==============================================================================
# VILNIUS ASSISTANT - RAILWAY DEPLOYMENT SCRIPT
# ==============================================================================
# One-command deployment to Railway platform
# Usage: ./scripts/railway-deploy.sh [setup|deploy|status]
#
# Prerequisites:
# - Railway CLI installed: npm install -g @railway/cli
# - Railway account and login: railway login
# ==============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default action
ACTION="${1:-deploy}"

echo -e "${BLUE}===============================================================================${NC}"
echo -e "${BLUE}🚂 VILNIUS ASSISTANT - RAILWAY DEPLOYMENT${NC}"
echo -e "${BLUE}===============================================================================${NC}"
echo -e "Action: ${YELLOW}${ACTION}${NC}"
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

    # Check Railway CLI
    if ! command -v railway &> /dev/null; then
        log_error "Railway CLI is not installed."
        log_info "Install it with: npm install -g @railway/cli"
        log_info "Or visit: https://docs.railway.app/develop/cli"
        exit 1
    fi

    # Check if logged in to Railway
    if ! railway whoami &> /dev/null; then
        log_error "Not logged in to Railway."
        log_info "Login with: railway login"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Function to setup Railway project
setup_railway_project() {
    log_info "Setting up Railway project..."

    # Check if already linked to a project
    if [ -f ".railway/service.json" ]; then
        log_info "Already linked to Railway project"
        railway status
        return 0
    fi

    log_info "Creating new Railway project..."
    railway create "vilnius-assistant"

    log_info "Adding PostgreSQL database..."
    railway add postgresql

    log_success "Railway project setup completed"
}

# Function to configure environment variables
configure_environment() {
    log_info "Configuring environment variables..."

    # Required environment variables for Railway
    local required_vars=(
        "OPENROUTER_API_KEY"
        "MISTRAL_API_KEY"
        "JWT_SECRET"
        "JWT_REFRESH_SECRET"
        "ADMIN_RECOVERY_KEY"
        "CHROMA_URL"
        "CHROMA_TENANT"
        "CHROMA_DATABASE"
        "CHROMA_AUTH_TOKEN"
    )

    # Check if variables are already set
    log_info "Checking current environment variables..."
    railway variables

    echo
    log_warning "Please ensure the following environment variables are set in Railway:"
    echo

    for var in "${required_vars[@]}"; do
        echo -e "  🔑 ${YELLOW}$var${NC}"
    done

    echo
    log_info "You can set variables using Railway CLI:"
    log_info "  railway variables set OPENROUTER_API_KEY=your-key-here"
    echo
    log_info "Or use Railway dashboard: https://railway.app/dashboard"
    echo

    # Optional: Interactive setup
    echo -e "${YELLOW}Would you like to set up environment variables interactively? (y/N)${NC}"
    read -r setup_vars

    if [[ $setup_vars =~ ^[Yy]$ ]]; then
        setup_environment_interactive
    else
        log_info "Skipping interactive setup. Please configure variables manually."
    fi
}

# Function for interactive environment setup
setup_environment_interactive() {
    log_info "Interactive environment variable setup..."

    # OpenRouter API Key
    echo -e "${BLUE}Enter your OpenRouter API Key:${NC}"
    read -r openrouter_key
    if [ -n "$openrouter_key" ]; then
        railway variables set OPENROUTER_API_KEY="$openrouter_key"
    fi

    # Mistral API Key
    echo -e "${BLUE}Enter your Mistral API Key:${NC}"
    read -r mistral_key
    if [ -n "$mistral_key" ]; then
        railway variables set MISTRAL_API_KEY="$mistral_key"
    fi

    # JWT Secrets
    echo -e "${BLUE}Enter JWT Secret (or press Enter to generate):${NC}"
    read -r jwt_secret
    if [ -z "$jwt_secret" ]; then
        jwt_secret=$(openssl rand -base64 32)
        log_info "Generated JWT Secret: $jwt_secret"
    fi
    railway variables set JWT_SECRET="$jwt_secret"

    echo -e "${BLUE}Enter JWT Refresh Secret (or press Enter to generate):${NC}"
    read -r jwt_refresh_secret
    if [ -z "$jwt_refresh_secret" ]; then
        jwt_refresh_secret=$(openssl rand -base64 32)
        log_info "Generated JWT Refresh Secret: $jwt_refresh_secret"
    fi
    railway variables set JWT_REFRESH_SECRET="$jwt_refresh_secret"

    # Admin Recovery Key
    echo -e "${BLUE}Enter Admin Recovery Key (or press Enter to generate):${NC}"
    read -r admin_key
    if [ -z "$admin_key" ]; then
        admin_key=$(openssl rand -base64 24)
        log_info "Generated Admin Recovery Key: $admin_key"
    fi
    railway variables set ADMIN_RECOVERY_KEY="$admin_key"

    # Chroma DB settings
    echo -e "${BLUE}Enter ChromaDB URL (e.g., https://api.trychroma.com):${NC}"
    read -r chroma_url
    if [ -n "$chroma_url" ]; then
        railway variables set CHROMA_URL="$chroma_url"
    fi

    echo -e "${BLUE}Enter ChromaDB Tenant ID:${NC}"
    read -r chroma_tenant
    if [ -n "$chroma_tenant" ]; then
        railway variables set CHROMA_TENANT="$chroma_tenant"
    fi

    echo -e "${BLUE}Enter ChromaDB Database Name:${NC}"
    read -r chroma_database
    if [ -n "$chroma_database" ]; then
        railway variables set CHROMA_DATABASE="$chroma_database"
    fi

    echo -e "${BLUE}Enter ChromaDB Auth Token:${NC}"
    read -r chroma_token
    if [ -n "$chroma_token" ]; then
        railway variables set CHROMA_AUTH_TOKEN="$chroma_token"
    fi

    log_success "Environment variables configured"
}

# Function to deploy to Railway
deploy_to_railway() {
    log_info "Deploying to Railway..."

    # Deploy the application
    log_info "Starting deployment..."
    railway up --detach

    log_info "Deployment initiated. You can monitor progress at:"
    log_info "https://railway.app/dashboard"

    # Wait a bit for deployment to start
    sleep 5

    # Show deployment status
    railway status

    log_success "Deployment started successfully"
}

# Function to run database migrations
run_migrations() {
    log_info "Running database migrations..."

    # Wait for deployment to be ready
    log_info "Waiting for deployment to be ready..."
    sleep 30

    # Run Prisma migrations
    log_info "Running Prisma migrate deploy..."
    railway run npx prisma migrate deploy

    # Run database seeding
    log_info "Seeding database..."
    railway run npm run db:seed || log_warning "Database seeding failed (might already be seeded)"

    log_success "Database setup completed"
}

# Function to show deployment status
show_status() {
    log_info "Railway deployment status..."

    # Show project info
    railway status

    # Show recent deployments
    echo
    log_info "Recent deployments:"
    railway logs --limit 20

    # Show environment variables
    echo
    log_info "Current environment variables:"
    railway variables

    # Show service URL
    echo
    log_info "Service URL:"
    railway domain
}

# Function to show deployment summary
show_deployment_summary() {
    local service_url=$(railway domain 2>/dev/null | grep -o 'https://[^[:space:]]*' | head -1)

    echo
    echo -e "${GREEN}===============================================================================${NC}"
    echo -e "${GREEN}🎉 RAILWAY DEPLOYMENT SUCCESSFUL${NC}"
    echo -e "${GREEN}===============================================================================${NC}"
    echo

    if [ -n "$service_url" ]; then
        echo -e "${BLUE}Application URLs:${NC}"
        echo -e "  🌐 Main Application:     $service_url"
        echo -e "  👨‍💼 Agent Dashboard:       $service_url/agent-dashboard.html"
        echo -e "  ⚙️  Settings/Admin:       $service_url/settings.html"
        echo -e "  🔑 Login:                $service_url/login.html"
        echo -e "  📖 API Documentation:   $service_url/docs"
        echo -e "  💚 Health Check:        $service_url/health"
        echo
    fi

    echo -e "${BLUE}Default Admin Credentials:${NC}"
    echo -e "  📧 Email:    admin@vilnius.lt"
    echo -e "  🔒 Password: admin123"
    echo

    echo -e "${BLUE}Useful Railway Commands:${NC}"
    echo -e "  📊 View logs:           railway logs"
    echo -e "  📊 Follow logs:         railway logs --tail"
    echo -e "  🔄 Redeploy:            railway up"
    echo -e "  ⚙️  Set variables:       railway variables set KEY=value"
    echo -e "  🗄️  Database shell:      railway shell"
    echo -e "  📈 Dashboard:           https://railway.app/dashboard"
    echo

    echo -e "${YELLOW}Next Steps:${NC}"
    echo -e "  1. 🌐 Visit your application URL to test"
    echo -e "  2. 🔑 Login with admin credentials"
    echo -e "  3. 📚 Upload documents in Knowledge Management"
    echo -e "  4. 🤖 Configure AI providers in System Settings"
    echo -e "  5. 👥 Create agent accounts for your team"
    echo -e "  6. 🔗 Configure custom domain in Railway dashboard"
    echo
}

# Main function
main() {
    case $ACTION in
        "setup")
            echo
            check_prerequisites
            echo
            setup_railway_project
            echo
            configure_environment
            ;;
        "deploy")
            echo
            check_prerequisites
            echo
            deploy_to_railway
            echo
            run_migrations
            echo
            show_deployment_summary
            ;;
        "status")
            echo
            check_prerequisites
            echo
            show_status
            ;;
        *)
            log_error "Unknown action: $ACTION"
            log_info "Usage: $0 [setup|deploy|status]"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap 'log_error "Railway deployment interrupted"; exit 1' INT TERM

# Run main function
main

log_success "Railway deployment script completed successfully!"