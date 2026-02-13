# Production-ready Dockerfile for AI Debates API
# Uses bun build --compile to create a standalone binary
# Supports multi-arch builds (amd64/arm64)

FROM oven/bun:1-slim AS builder

# Docker provides TARGETARCH (amd64 or arm64)
ARG TARGETARCH

WORKDIR /app

# Copy workspace package.json files
COPY package.json bun.lock ./
COPY src/api/package.json ./src/api/
COPY src/web/package.json ./src/web/
COPY src/cli/package.json ./src/cli/

# Install all dependencies (needed for compilation)
RUN bun install --production --ignore-scripts || true

# Copy source files
COPY src/api/ ./src/api/

# Compile to standalone binary (map amd64->x64 for bun)
RUN BUN_ARCH=$([ "$TARGETARCH" = "amd64" ] && echo "x64" || echo "$TARGETARCH") && \
    bun build --compile --minify --bytecode \
    --target=bun-linux-${BUN_ARCH} \
    ./src/api/index.ts \
    --outfile /app/api-server

# Production runtime - minimal image
FROM debian:bookworm-slim AS runtime

# Install security updates and required libs
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends wget ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r app && useradd -r -g app app

WORKDIR /app

# Copy compiled binary
COPY --from=builder --chown=app:app /app/api-server ./api-server

# Switch to non-root user
USER app

# Environment
ENV NODE_ENV=production
ENV PORT=3001

# OCI labels
LABEL org.opencontainers.image.source="https://github.com/nibty/agonai"
LABEL org.opencontainers.image.title="AI Debates API"
LABEL org.opencontainers.image.description="API server for AI Debates platform"

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

ENTRYPOINT ["./api-server"]
