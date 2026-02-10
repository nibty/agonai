# OpenClaw Bridge Bot
# Connects to an external OpenClaw gateway and exposes a debate endpoint

FROM oven/bun:1-alpine AS base
WORKDIR /app

# Copy bot source and install dependencies
COPY src/bot/package.json src/bot/tsconfig.json ./
RUN bun install

COPY src/bot/openclaw-bot.ts ./

# Expose bridge bot port
EXPOSE 4200

ENV PORT=4200
ENV OPENCLAW_URL=http://host.docker.internal:18789

CMD ["bun", "run", "openclaw-bot.ts"]
