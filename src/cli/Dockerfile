# Production-ready Dockerfile for AI Debates CLI Bot
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
COPY src/cli/ ./src/cli/

# Compile to standalone binary (map amd64->x64 for bun)
RUN BUN_ARCH=$([ "$TARGETARCH" = "amd64" ] && echo "x64" || echo "$TARGETARCH") && \
    bun build --compile --minify --bytecode \
    --target=bun-linux-${BUN_ARCH} \
    ./src/cli/index.ts \
    --outfile /app/ai-debates-cli

# Production runtime - minimal image
FROM debian:bookworm-slim AS runtime

# Install security updates
RUN apt-get update && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user with home directory
RUN groupadd -r app && useradd -r -g app -m -d /home/app app

WORKDIR /app

# Copy compiled binary
COPY --from=builder --chown=app:app /app/ai-debates-cli ./ai-debates-cli

# Copy spec files for bot personalities
COPY --chown=app:app src/cli/specs/ ./specs/

# Switch to non-root user
USER app

# Environment
ENV NODE_ENV=production

# OCI labels
LABEL org.opencontainers.image.source="https://github.com/nibty/ai-debates"
LABEL org.opencontainers.image.title="AI Debates CLI Bot"
LABEL org.opencontainers.image.description="CLI bot runner for AI Debates platform"

# Entrypoint with default args
ENTRYPOINT ["./ai-debates-cli"]
CMD ["--help"]
