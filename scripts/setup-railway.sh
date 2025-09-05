#!/bin/bash

# 🚀 Vilnius Assistant Railway Setup Script
# This script automates the entire Railway deployment process

set -e  # Exit on any error

echo "🎯 Setting up Vilnius Assistant on Railway..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Railway CLI is installed
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        print_status "Railway CLI not found. Installing..."
        npm install -g @railway/cli
        print_success "Railway CLI installed"
    else
        print_success "Railway CLI is already installed"
    fi
}

# Login to Railway
railway_login() {
    print_status "Checking Railway authentication..."
    if railway whoami &> /dev/null; then
        print_success "Already logged in to Railway"
    else
        print_status "Please login to Railway..."
        railway login
    fi
}

# Create or select Railway project
setup_railway_project() {
    print_status "Setting up Railway project..."
    
    # Check if we're in a Railway project directory
    if [ -f "railway.json" ]; then
        print_success "Found existing Railway project"
        PROJECT_ID=$(railway status | grep "Project:" | awk '{print $2}')
    else
        print_status "Creating new Railway project..."
        railway init --name vilnius-assistant --yes
        print_success "Railway project created"
    fi
}

# Set environment variables
setup_environment_variables() {
    print_status "Configuring environment variables..."
    
    # Check if required variables are already set
    if railway variables get OPENROUTER_API_KEY &> /dev/null; then
        print_success "Environment variables already configured"
        return
    fi
    
    echo ""
    print_warning "You need to set up the following environment variables:"
    echo ""
    
    # Get OpenRouter API key
    read -p "Enter your OpenRouter API key: " OPENROUTER_KEY
    if [ -z "$OPENROUTER_KEY" ]; then
        print_error "OpenRouter API key is required"
        exit 1
    fi
    
    # Generate secure secrets if not provided
    read -p "Enter JWT secret (or press Enter to generate): " JWT_SECRET
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(openssl rand -base64 32)
        print_status "Generated JWT secret"
    fi
    
    read -p "Enter JWT refresh secret (or press Enter to generate): " JWT_REFRESH_SECRET
    if [ -z "$JWT_REFRESH_SECRET" ]; then
        JWT_REFRESH_SECRET=$(openssl rand -base64 32)
        print_status "Generated JWT refresh secret"
    fi
    
    read -p "Enter admin recovery key (or press Enter to generate): " ADMIN_RECOVERY_KEY
    if [ -z "$ADMIN_RECOVERY_KEY" ]; then
        ADMIN_RECOVERY_KEY=$(openssl rand -base64 16)
        print_status "Generated admin recovery key"
    fi
    
    # Set all variables
    print_status "Setting environment variables..."
    railway variables set OPENROUTER_API_KEY="$OPENROUTER_KEY"
    railway variables set JWT_SECRET="$JWT_SECRET"
    railway variables set JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"
    railway variables set ADMIN_RECOVERY_KEY="$ADMIN_RECOVERY_KEY"
    railway variables set NODE_ENV="production"
    railway variables set PORT="3002"
    
    print_success "Environment variables configured"
}

# Deploy to Railway
deploy_to_railway() {
    print_status "Deploying to Railway..."
    
    # Deploy the application
    railway up --detach
    
    # Wait for deployment to complete
    print_status "Waiting for deployment to complete..."
    sleep 10
    
    # Check deployment status
    if railway status | grep -q "DEPLOYED"; then
        print_success "Application deployed successfully!"
        
        # Get the deployment URL
        DEPLOYMENT_URL=$(railway status | grep "URL:" | awk '{print $2}')
        print_success "Your app is live at: $DEPLOYMENT_URL"
        
        # Save deployment info
        echo "DEPLOYMENT_URL=$DEPLOYMENT_URL" > .railway-deployed
        echo "DEPLOYED_AT=$(date)" >> .railway-deployed
        
    else
        print_error "Deployment failed. Check Railway logs:"
        railway logs --tail 50
        exit 1
    fi
}

# Setup GitHub Actions
setup_github_actions() {
    print_status "Setting up GitHub Actions..."
    
    # Check if .github/workflows directory exists
    if [ ! -d ".github/workflows" ]; then
        mkdir -p .github/workflows
    fi
    
    # Check if deploy-railway.yml exists
    if [ -f ".github/workflows/deploy-railway.yml" ]; then
        print_success "GitHub Actions workflow already exists"
    else
        print_warning "GitHub Actions workflow not found. Please create it manually or copy from the repository."
    fi
    
    echo ""
    print_status "Next steps for GitHub Actions:"
    echo "1. Go to your GitHub repository settings"
    echo "2. Navigate to Secrets → Actions"
    echo "3. Add the following secrets:"
    echo "   - RAILWAY_TOKEN: $(railway tokens | head -1)"
    echo "   - OPENROUTER_API_KEY: $OPENROUTER_KEY"
    echo "   - JWT_SECRET: $JWT_SECRET"
    echo "   - JWT_REFRESH_SECRET: $JWT_REFRESH_SECRET"
    echo "   - ADMIN_RECOVERY_KEY: $ADMIN_RECOVERY_KEY"
    echo ""
    print_warning "Without these secrets, automatic deployment won't work."
}

# Health check
health_check() {
    print_status "Performing health check..."
    
    # Get the deployment URL
    DEPLOYMENT_URL=$(railway status | grep "URL:" | awk '{print $2}')
    
    if [ -z "$DEPLOYMENT_URL" ]; then
        print_error "Could not get deployment URL"
        return 1
    fi
    
    # Wait a bit for the app to fully start
    print_status "Waiting for application to start..."
    sleep 15
    
    # Check health endpoint
    if curl -f -s "$DEPLOYMENT_URL/health" > /dev/null; then
        print_success "Health check passed! Application is running."
        
        # Try to access the main page
        if curl -f -s "$DEPLOYMENT_URL" > /dev/null; then
            print_success "Application is fully accessible at: $DEPLOYMENT_URL"
        else
            print_warning "Application health check passed, but main page might still be loading."
        fi
    else
        print_error "Health check failed. Application might still be starting."
        print_status "Check the logs with: railway logs"
    fi
}

# Create deployment summary
create_deployment_summary() {
    print_status "Creating deployment summary..."
    
    DEPLOYMENT_URL=$(railway status | grep "URL:" | awk '{print $2}')
    PROJECT_ID=$(railway status | grep "Project:" | awk '{print $2}')
    
    cat > DEPLOYMENT_SUMMARY.md << EOF
# 🎯 Vilnius Assistant Deployment Summary

## 📋 Deployment Information
- **Deployed At**: $(date)
- **Project ID**: $PROJECT_ID
- **Deployment URL**: $DEPLOYMENT_URL
- **Status**: ✅ Successfully Deployed

## 🔗 Quick Access
- **Agent Dashboard**: $DEPLOYMENT_URL/agent-dashboard.html
- **Customer Widget**: $DEPLOYMENT_URL/embed-widget.html
- **Settings**: $DEPLOYMENT_URL/settings.html
- **Health Check**: $DEPLOYMENT_URL/health

## 🚀 Next Steps
1. **Test the application** - Visit the URLs above
2. **Setup GitHub Actions** - Add the required secrets to your GitHub repository
3. **Configure monitoring** - Set up alerts in Railway dashboard
4. **Custom domain** - (Optional) Add your custom domain

## 🔧 Management Commands
\`\`\`bash
# View logs
railway logs

# Check status
railway status

# Redeploy
railway up

# View environment variables
railway variables
\`\`\`

## 📊 Environment Variables Set
$(railway variables list)

---
*This deployment was created automatically by the setup script*
EOF

    print_success "Deployment summary created: DEPLOYMENT_SUMMARY.md"
}

# Main execution
main() {
    echo ""
    print_status "Starting Vilnius Assistant Railway setup..."
    echo ""
    
    # Check prerequisites
    check_railway_cli
    railway_login
    
    # Setup project
    setup_railway_project
    
    # Configure environment
    setup_environment_variables
    
    # Deploy application
    deploy_to_railway
    
    # Health check
    health_check
    
    # Setup GitHub Actions
    setup_github_actions
    
    # Create summary
    create_deployment_summary
    
    echo ""
    print_success "🎉 Setup completed successfully!"
    echo ""
    print_status "Your Vilnius Assistant is now running on Railway!"
    print_status "Check DEPLOYMENT_SUMMARY.md for details and next steps."
    echo ""
}

# Run the main function
main "$@"
