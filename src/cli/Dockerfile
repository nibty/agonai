# Production-ready Dockerfile for AI Debates CLI Bot
FROM oven/bun:1-slim AS base

# Install security updates
RUN apt-get update && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Stage 1: Install dependencies
FROM base AS dependencies

# Copy workspace package.json files (required for frozen-lockfile)
COPY package.json bun.lock ./
COPY src/api/package.json ./src/api/
COPY src/web/package.json ./src/web/
COPY src/cli/package.json ./src/cli/

# Install production dependencies only
RUN bun install --frozen-lockfile --ignore-scripts --production

# Stage 2: Build
FROM base AS builder

COPY --from=dependencies /app/node_modules ./node_modules

# Copy source files
COPY package.json ./
COPY src/cli/ ./src/cli/

# Stage 3: Production runtime
FROM base AS runtime

# Create non-root user
RUN groupadd -r app && useradd -r -g app app

# Copy application from builder
COPY --from=builder --chown=app:app /app ./

WORKDIR /app

# Switch to non-root user
USER app

# Environment
ENV NODE_ENV=production

# OCI labels
LABEL org.opencontainers.image.source="https://github.com/nibty/ai-debates"
LABEL org.opencontainers.image.title="AI Debates CLI Bot"
LABEL org.opencontainers.image.description="CLI bot runner for AI Debates platform"

# Default command - can be overridden with bot start args
CMD ["bun", "run", "cli", "bot", "start", "--help"]
