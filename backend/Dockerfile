FROM node:22-slim AS deps

# argon2 + Prisma engines need python3/make/g++ for native compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# pnpm v11 uses allowBuilds (map format); onlyBuiltDependencies was removed in v11
RUN printf 'allowBuilds:\n  "@prisma/engines": true\n  argon2: true\n  esbuild: true\n  prisma: true\n' > pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

# ── builder ──────────────────────────────────────────────────────
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# NOTE: prisma.config.ts is intentionally NOT copied here.
# prisma generate only needs the schema to generate TS types — it never connects
# to the DB. Without prisma.config.ts, Prisma reads schema.prisma directly and
# requires no DIRECT_URL or DATABASE_URL at build time.
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

# must run before tsc
RUN pnpm exec prisma generate
RUN pnpm exec tsc

# ── prod-deps (production-only install) ───────────────────────────
FROM node:22-slim AS prod-deps

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

WORKDIR /app

# Copy schema only — postinstall runs prisma generate which only needs the schema
COPY prisma ./prisma
COPY package.json pnpm-lock.yaml ./
RUN printf 'allowBuilds:\n  "@prisma/engines": true\n  argon2: true\n  esbuild: true\n  prisma: true\n' > pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile --prod

# ── runner ───────────────────────────────────────────────────────
FROM node:22-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# pnpm needed to run prisma generate (re-stamps ESM client into flat node_modules)
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

WORKDIR /app

# node_modules is a flat, npm-style directory (no .pnpm/ overhead) from prod-deps
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

COPY prisma ./prisma
# Re-generate prisma client so ESM exports are stamped into the flat node_modules
RUN pnpm exec prisma generate

COPY --from=builder /app/dist ./dist

USER node

ENV NODE_ENV=production

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5000) + '/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
