# ---- Build stage ----
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app

# Install deps (cached layer)
COPY package.json bun.lock* bunfig.toml* ./
RUN bun install --frozen-lockfile || bun install

# Copy source and build
COPY . .
RUN bun run build

# ---- Runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy built output + minimal runtime files
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
