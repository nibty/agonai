# Production-ready Dockerfile for AI Debates API
FROM oven/bun:1-slim AS base

# Install security updates
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends wget ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Stage 1: Install dependencies
FROM base AS dependencies

# Copy workspace package.json files (required for frozen-lockfile)
COPY package.json bun.lock ./
COPY src/api/package.json ./src/api/
COPY src/web/package.json ./src/web/
COPY src/cli/package.json ./src/cli/

# Install only api dependencies
RUN bun install --frozen-lockfile --ignore-scripts

# Stage 2: Build
FROM base AS builder

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/src/api/node_modules ./src/api/node_modules

# Copy source files
COPY package.json ./
COPY src/api/ ./src/api/
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
ENV PORT=3001

# OCI labels
LABEL org.opencontainers.image.source="https://github.com/nibty/ai-debates"
LABEL org.opencontainers.image.title="AI Debates API"
LABEL org.opencontainers.image.description="API server for AI Debates platform"

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["bun", "run", "src/api/index.ts"]
