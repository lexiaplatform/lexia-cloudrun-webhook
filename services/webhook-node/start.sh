#!/bin/bash

# Startup script for Cloud Run
# Manages webhook and worker processes

set -e

echo "======================================"
echo "🚀 Léxia Cloud Run Startup"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check environment variables
echo -e "${BLUE}Step 1: Checking environment variables...${NC}"
if [ -z "$DATABASE_URL" ]; then
  echo -e "${YELLOW}⚠️  DATABASE_URL not set${NC}"
fi
if [ -z "$REDIS_URL" ]; then
  echo -e "${YELLOW}⚠️  REDIS_URL not set${NC}"
fi
if [ -z "$WHATSAPP_ACCESS_TOKEN" ]; then
  echo -e "${YELLOW}⚠️  WHATSAPP_ACCESS_TOKEN not set${NC}"
fi
echo -e "${GREEN}✓ Environment check complete${NC}\n"

# Step 2: Run database migrations
echo -e "${BLUE}Step 2: Running database migrations...${NC}"
if [ -z "$SKIP_MIGRATIONS" ]; then
  pnpm run db:push || {
    echo -e "${YELLOW}⚠️  Migration warning (continuing anyway)${NC}"
  }
else
  echo -e "${YELLOW}Skipping migrations (SKIP_MIGRATIONS=true)${NC}"
fi
echo -e "${GREEN}✓ Migrations complete${NC}\n"

# Step 3: Start webhook
echo -e "${BLUE}Step 3: Starting webhook server...${NC}"
pnpm run webhook:start &
WEBHOOK_PID=$!
echo -e "${GREEN}✓ Webhook started (PID: $WEBHOOK_PID)${NC}\n"

# Step 4: Start worker
echo -e "${BLUE}Step 4: Starting background worker...${NC}"
pnpm run worker:start &
WORKER_PID=$!
echo -e "${GREEN}✓ Worker started (PID: $WORKER_PID)${NC}\n"

# Step 5: Health check
echo -e "${BLUE}Step 5: Waiting for services to be ready...${NC}"
sleep 5
echo -e "${GREEN}✓ Services should be ready${NC}\n"

# Summary
echo "======================================"
echo -e "${GREEN}✅ Léxia is running!${NC}"
echo "======================================"
echo "Webhook PID: $WEBHOOK_PID"
echo "Worker PID: $WORKER_PID"
echo "Listening on port 8080"
echo ""
echo "Press Ctrl+C to stop"
echo "======================================"

# Wait for processes
wait
