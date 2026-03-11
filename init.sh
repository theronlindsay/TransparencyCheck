#!/bin/bash

# Transparency Check - Rapid Setup Script
# This script prepares the environment and launches the stack with zero manual config.

# Colors
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Generate default .env if missing
if [ ! -f .env ]; then
  echo "📄 Creating default .env for local development..."
  cat <<EOF > .env
# --- Required Credentials ---
# Get a real key at https://api.congress.gov/sign-up/
CONGRESS_API_KEY=DEMO_KEY

# Required for AI summaries (app will run without it, but summaries will be empty)
OPENAI_API_KEY=

# --- Local Database Configuration ---
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=password123

# --- Networking ---
# Leave VITE_API_BASE_URL empty for Docker/Nginx environments to use relative paths
VITE_API_BASE_URL=
EOF
  echo "✅ Default .env created."
else
  echo "ℹ️  Using existing .env file."
fi

# 2. Check for Podman vs Docker
if command -v podman &> /dev/null; then
    COMPOSE_CMD="podman"
    echo "🐳 Using Podman for container orchestration..."
elif command -v docker &> /dev/null; then
    COMPOSE_CMD="docker"
    echo "🐳 Using Docker for container orchestration..."
else
    echo "❌ Error: Neither 'podman' nor 'docker' was found. Please install one to continue."
    exit 1
fi

# 3. Build and launch the stack
echo "🏗️  Building and starting containers... (this may take a few minutes on first run)"
$COMPOSE_CMD compose up -d --build

# 4. Success Output
PUBLIC_IP=$(curl -s ifconfig.me || echo "Not Available")
PRIVATE_IP=$(hostname -I | awk '{print $1}' || echo "localhost")

{
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 TRANSPARENCY CHECK IS NOW DEPLOYED!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 ACCESS PATHS:"
echo ""
echo "  [ LOCAL / PRIVATE NETWORK ] - Use this for devices in your house/office"
echo -e "  🔗 Frontend:  http://$PRIVATE_IP:8080 ${RED}<----- Ctrl/CMD + Click this one${NC}"
echo "  🔗 Backend:   http://$PRIVATE_IP:3000"
echo ""
echo "  [ PUBLIC / EXTERNAL ] - Use this for access from outside your network"
echo "  🔗 Frontend:  http://$PUBLIC_IP:8080"
echo "  🔗 Backend:   http://$PUBLIC_IP:3000"
echo ""
echo -e "  ${RED}⚠️  WARNING: To access the app from the internet, you MUST forward${NC}"
echo -e "  ${RED}   ports 8080 and 3000 in your router settings to this machine.${NC}"
echo ""
echo "📊 DATABASE ACCESS:"
echo "  🔗 Local URI: mongodb://admin:password123@$PRIVATE_IP:27017"
echo ""
echo "📝 OPERATIONS:"
echo "  💡 Tip: Use '$COMPOSE_CMD logs -f transparencycheck-server-1' to watch the background sync process."
echo "  💾 Database Shell: $COMPOSE_CMD exec -it transparencycheck-mongodb-1 mongosh" 
echo "  🔄 Restart: $COMPOSE_CMD compose down && ./init.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
} | tee instructions.txt

# Strip ANSI color codes from instructions.txt for better readability in text editors
sed -i 's/\x1b\[[0-9;]*m//g' instructions.txt
