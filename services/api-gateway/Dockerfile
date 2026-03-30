# ---------------------------------------------------------------------------
# Lurk API Gateway (Node / Express) — Multi-stage Dockerfile
# ---------------------------------------------------------------------------

# Stage 1: Install dependencies
FROM node:22-slim AS deps

WORKDIR /app

# Copy root workspace files for monorepo resolution
COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/acl-resolver/package.json packages/acl-resolver/
COPY packages/policy-engine/package.json packages/policy-engine/
COPY services/api-gateway/package.json services/api-gateway/

RUN npm ci --workspace=services/api-gateway --include-workspace-root

# Stage 2: Build
FROM node:22-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=deps /app/packages/acl-resolver/node_modules ./packages/acl-resolver/node_modules
COPY --from=deps /app/packages/policy-engine/node_modules ./packages/policy-engine/node_modules
COPY --from=deps /app/services/api-gateway/node_modules ./services/api-gateway/node_modules

COPY tsconfig.base.json ./
COPY packages/shared-types/ packages/shared-types/
COPY packages/acl-resolver/ packages/acl-resolver/
COPY packages/policy-engine/ packages/policy-engine/
COPY services/api-gateway/ services/api-gateway/

# Build shared packages first, then the service
RUN npx tsc --project packages/shared-types/tsconfig.json && \
    npx tsc --project packages/acl-resolver/tsconfig.json && \
    npx tsc --project packages/policy-engine/tsconfig.json && \
    npx tsc --project services/api-gateway/tsconfig.json

# Stage 3: Production
FROM node:22-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install production deps only
COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/acl-resolver/package.json packages/acl-resolver/
COPY packages/policy-engine/package.json packages/policy-engine/
COPY services/api-gateway/package.json services/api-gateway/

RUN npm ci --workspace=services/api-gateway --include-workspace-root --omit=dev

# Copy built output
COPY --from=builder /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=builder /app/packages/acl-resolver/dist packages/acl-resolver/dist
COPY --from=builder /app/packages/policy-engine/dist packages/policy-engine/dist
COPY --from=builder /app/services/api-gateway/dist services/api-gateway/dist

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

USER node

CMD ["node", "services/api-gateway/dist/index.js"]
