# ---------------------------------------------------------------------------
# Lurk API Gateway (Node / Express) — Multi-stage Dockerfile
# ---------------------------------------------------------------------------

# Stage 1: Install dependencies and build
FROM node:22-slim AS builder

WORKDIR /app

# Copy root workspace files for monorepo resolution
COPY package.json package-lock.json ./
COPY services/api-gateway/package.json services/api-gateway/

RUN npm ci --workspace=services/api-gateway --include-workspace-root

# Copy source code
COPY tsconfig.base.json ./
COPY services/api-gateway/ services/api-gateway/

RUN npx tsc --project services/api-gateway/tsconfig.json --noCheck

# Stage 2: Production
FROM node:22-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY services/api-gateway/package.json services/api-gateway/

RUN npm ci --workspace=services/api-gateway --include-workspace-root --omit=dev

COPY --from=builder /app/services/api-gateway/dist services/api-gateway/dist

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

USER node

CMD ["node", "services/api-gateway/dist/index.js"]
