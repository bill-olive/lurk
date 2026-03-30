# ---------------------------------------------------------------------------
# Lurk Web Admin (Next.js) — Multi-stage Dockerfile
# ---------------------------------------------------------------------------

# Stage 1: Install dependencies
FROM node:22-slim AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/web/package.json apps/web/

RUN npm ci --workspace=apps/web --include-workspace-root

# Stage 2: Build
FROM node:22-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

COPY tsconfig.base.json ./
COPY packages/shared-types/ packages/shared-types/

COPY apps/web/ apps/web/

# Build shared types first
RUN npx tsc --project packages/shared-types/tsconfig.json

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/web && npx next build

# Stage 3: Production — use standalone output
FROM node:22-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js standalone output includes only what is needed
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

USER node

CMD ["node", "apps/web/server.js"]
