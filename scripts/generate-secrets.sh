#!/bin/bash
# Secret Generator for Lizdeika
# Automatically generates all required cryptographic secrets

set -e  # Exit on any error

echo "========================================="
echo "Lizdeika Secret Generator"
echo "========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}Error: openssl is not installed${NC}"
    echo "Install it with: sudo apt-get install openssl"
    exit 1
fi

# Generate secrets
echo "Generating cryptographic secrets..."
echo ""

JWT_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)
TOTP_ENCRYPTION_KEY=$(openssl rand -base64 48)
ADMIN_RECOVERY_KEY=$(openssl rand -base64 32)

echo -e "${GREEN}✓ Secrets generated successfully${NC}"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo "Run 'cp .env.template .env' first, or create .env manually"
    echo ""
    echo "Here are your generated secrets:"
    echo "================================="
    echo ""
    echo "JWT_SECRET=$JWT_SECRET"
    echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
    echo "TOTP_ENCRYPTION_KEY=$TOTP_ENCRYPTION_KEY"
    echo "ADMIN_RECOVERY_KEY=$ADMIN_RECOVERY_KEY"
    echo ""
    echo "Copy these into your .env file"
    exit 0
fi

# Check if secrets already exist in .env
EXISTING_SECRETS=0
if grep -q "^JWT_SECRET=.\+" .env 2>/dev/null; then
    EXISTING_SECRETS=1
fi

if [ $EXISTING_SECRETS -eq 1 ]; then
    echo -e "${YELLOW}Warning: Secrets already exist in .env${NC}"
    echo ""
    echo "Options:"
    echo "  1) Keep existing secrets (safe - recommended)"
    echo "  2) Replace with new secrets (⚠️  will invalidate all JWT tokens)"
    echo "  3) Show new secrets without updating .env"
    echo ""
    read -p "Enter choice [1-3]: " choice

    case $choice in
        1)
            echo -e "${GREEN}✓ Keeping existing secrets${NC}"
            exit 0
            ;;
        2)
            echo -e "${YELLOW}⚠️  Replacing secrets...${NC}"
            ;;
        3)
            echo ""
            echo "Generated secrets (not saved):"
            echo "================================="
            echo ""
            echo "JWT_SECRET=$JWT_SECRET"
            echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
            echo "TOTP_ENCRYPTION_KEY=$TOTP_ENCRYPTION_KEY"
            echo "ADMIN_RECOVERY_KEY=$ADMIN_RECOVERY_KEY"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice. Exiting.${NC}"
            exit 1
            ;;
    esac
fi

# Create backup
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✓ Created backup of .env${NC}"

# Update or add secrets to .env
update_or_add_secret() {
    local key=$1
    local value=$2
    local file=".env"

    if grep -q "^${key}=" "$file" 2>/dev/null; then
        # Update existing (using | as delimiter to avoid issues with / in base64)
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    elif grep -q "^#${key}=" "$file" 2>/dev/null; then
        # Uncomment and update
        sed -i "s|^#${key}=.*|${key}=${value}|" "$file"
    else
        # Add new entry
        echo "${key}=${value}" >> "$file"
    fi
}

# Apply secrets
update_or_add_secret "JWT_SECRET" "$JWT_SECRET"
update_or_add_secret "JWT_REFRESH_SECRET" "$JWT_REFRESH_SECRET"
update_or_add_secret "TOTP_ENCRYPTION_KEY" "$TOTP_ENCRYPTION_KEY"
update_or_add_secret "ADMIN_RECOVERY_KEY" "$ADMIN_RECOVERY_KEY"

echo -e "${GREEN}✓ Updated .env with generated secrets${NC}"
echo ""
echo "Secret lengths:"
echo "  - JWT_SECRET: ${#JWT_SECRET} chars"
echo "  - JWT_REFRESH_SECRET: ${#JWT_REFRESH_SECRET} chars"
echo "  - TOTP_ENCRYPTION_KEY: ${#TOTP_ENCRYPTION_KEY} chars"
echo "  - ADMIN_RECOVERY_KEY: ${#ADMIN_RECOVERY_KEY} chars"
echo ""
echo -e "${GREEN}✓ All secrets configured successfully${NC}"
echo ""
echo "Next steps:"
echo "  1. Add your API keys to .env (OpenRouter, Mistral, ChromaDB)"
echo "  2. Set SITE_URL in .env (REQUIRED for production)"
echo "  3. Run: docker compose -f docker-compose.prod.yml up -d"
