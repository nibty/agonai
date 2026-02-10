#!/bin/bash
set -e

# Generate OpenClaw config with webhooks enabled
CONFIG_FILE="/root/.openclaw/openclaw.json"

# Create config if it doesn't exist or OPENCLAW_TOKEN is set
if [ ! -f "$CONFIG_FILE" ] || [ -n "$OPENCLAW_TOKEN" ]; then
  echo "Creating OpenClaw configuration..."

  # Use provided token or generate one using node/bun
  TOKEN="${OPENCLAW_TOKEN:-$(bun -e "console.log(require('crypto').randomBytes(32).toString('hex'))")}"

  cat > "$CONFIG_FILE" << EOF
{
  "hooks": {
    "enabled": true,
    "token": "$TOKEN",
    "path": "/hooks"
  },
  "gateway": {
    "port": 18789
  }
}
EOF

  echo "OpenClaw configured with webhook token"

  # Export for the bridge bot
  export OPENCLAW_TOKEN="$TOKEN"
fi

# Start OpenClaw gateway in background
echo "Starting OpenClaw gateway on port 18789..."
openclaw gateway --port 18789 &
OPENCLAW_PID=$!

# Wait for gateway to be ready
echo "Waiting for OpenClaw gateway to start..."
for i in {1..30}; do
  if curl -s http://localhost:18789/health > /dev/null 2>&1; then
    echo "OpenClaw gateway is ready"
    break
  fi
  sleep 1
done

# Start the bridge bot
echo "Starting OpenClaw bridge bot on port ${PORT:-4200}..."
cd /app/src/bot
exec bun run openclaw-bot.ts
