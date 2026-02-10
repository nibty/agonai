#!/bin/bash
set -e

echo "============================================"
echo "  OpenClaw Debate Bot - Complete Setup"
echo "============================================"

# Check for API keys
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
  echo ""
  echo "ERROR: No API key provided!"
  echo ""
  echo "Please set one of these environment variables:"
  echo "  - ANTHROPIC_API_KEY (for Claude)"
  echo "  - OPENAI_API_KEY (for GPT)"
  echo ""
  echo "Example:"
  echo "  docker compose up -e ANTHROPIC_API_KEY=sk-ant-..."
  echo ""
  exit 1
fi

# Generate webhook token
WEBHOOK_TOKEN="${OPENCLAW_TOKEN:-$(bun -e "console.log(require('crypto').randomBytes(32).toString('hex'))")}"
export OPENCLAW_TOKEN="$WEBHOOK_TOKEN"

# Determine which provider to use
if [ -n "$ANTHROPIC_API_KEY" ]; then
  PROVIDER="anthropic"
  echo "Using Anthropic Claude as AI provider"
else
  PROVIDER="openai"
  echo "Using OpenAI GPT as AI provider"
fi

# Create minimal OpenClaw configuration (API keys passed via env vars)
CONFIG_FILE="/root/.openclaw/openclaw.json"
echo "Creating OpenClaw configuration..."

cat > "$CONFIG_FILE" << EOF
{
  "hooks": {
    "enabled": true,
    "token": "$WEBHOOK_TOKEN",
    "path": "/hooks"
  }
}
EOF

echo "Configuration created"

# Start OpenClaw gateway in background
# API keys are passed via environment variables (ANTHROPIC_API_KEY, OPENAI_API_KEY)
echo ""
echo "Starting OpenClaw gateway on port 18789..."
OPENCLAW_HOOKS_ENABLED=true \
OPENCLAW_HOOKS_TOKEN="$WEBHOOK_TOKEN" \
OPENCLAW_GATEWAY_TOKEN="$WEBHOOK_TOKEN" \
openclaw gateway --port 18789 --allow-unconfigured --token "$WEBHOOK_TOKEN" 2>&1 &
GATEWAY_PID=$!

# Wait for gateway to be ready
echo "Waiting for gateway to start..."
READY=false
for i in {1..30}; do
  if curl -sf http://localhost:18789/health > /dev/null 2>&1; then
    echo "Gateway is ready!"
    READY=true
    break
  fi

  # Check if process died
  if ! kill -0 $GATEWAY_PID 2>/dev/null; then
    echo "Gateway process exited unexpectedly"
    echo "Checking logs..."
    sleep 2
    break
  fi

  sleep 1
done

if [ "$READY" = false ]; then
  echo ""
  echo "Warning: Gateway may not be fully ready"
  echo "The bridge bot will retry connections automatically"
  echo ""
fi

# Start the bridge bot
echo ""
echo "Starting bridge bot on port ${PORT:-4200}..."
echo ""
echo "============================================"
echo "  Bot is ready for debates!"
echo "============================================"
echo ""
echo "  Debate endpoint: http://localhost:${PORT:-4200}/debate"
echo "  Health check:    http://localhost:${PORT:-4200}/health"
echo ""
echo "  Register this bot at the AI Debates Arena:"
echo "    Endpoint: http://localhost:${PORT:-4200}/debate"
echo ""
echo "============================================"
echo ""

cd /app
exec bun run openclaw-bot.ts
