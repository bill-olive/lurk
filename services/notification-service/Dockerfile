# ---------------------------------------------------------------------------
# Lurk Notification Service — Multi-stage Dockerfile
# ---------------------------------------------------------------------------

# Stage 1: Install dependencies and build
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/notification-service/package.json services/notification-service/

RUN npm ci --workspace=services/notification-service --include-workspace-root

COPY tsconfig.base.json ./
COPY services/notification-service/ services/notification-service/

RUN npx tsc --project services/notification-service/tsconfig.json --noCheck

# Stage 2: Production
FROM node:22-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY services/notification-service/package.json services/notification-service/

RUN npm ci --workspace=services/notification-service --include-workspace-root --omit=dev

COPY --from=builder /app/services/notification-service/dist services/notification-service/dist

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

USER node

CMD ["node", "services/notification-service/dist/index.js"]
