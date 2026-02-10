# OpenClaw Debate Bot
# Runs the OpenClaw gateway and bridge bot for AI Debates

FROM oven/bun:1 AS base
WORKDIR /app

# Install OpenClaw globally
RUN bun install -g openclaw@latest

# Copy bot source
COPY src/bot/openclaw-bot.ts ./src/bot/
COPY src/bot/package.json ./src/bot/
COPY src/bot/tsconfig.json ./src/bot/

# Install bot dependencies
WORKDIR /app/src/bot
RUN bun install

# Create OpenClaw config directory
RUN mkdir -p /root/.openclaw

# Copy startup script
COPY docker/openclaw-bot/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose ports
# 18789 - OpenClaw gateway
# 4200  - Bridge bot
EXPOSE 18789 4200

ENV OPENCLAW_URL=http://localhost:18789
ENV PORT=4200

ENTRYPOINT ["/entrypoint.sh"]
