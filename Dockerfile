# Multi-Stage Build for CampusSync (Optimized for ARM64 & AMD64)
# 1. Builder Stage
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder
WORKDIR /app

# Copy shared package
COPY shared/package*.json ./shared/
COPY shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
RUN cd shared && npm install && npm run build

# Copy web package and build static frontend SPA
COPY web/package*.json ./web/
COPY web/tsconfig*.json ./web/
COPY web/vite.config.ts ./web/
COPY web/index.html ./web/
COPY web/public ./web/public
COPY web/src ./web/src
RUN cd web && npm install && npm run build

# Copy server package and build backend
COPY server/package*.json ./server/
COPY server/tsconfig.json ./server/
COPY server/src ./server/src
RUN cd server && npm install && npm run build

# 2. Production Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app/server
ENV NODE_ENV=production

# Install production dependencies for server
COPY server/package*.json ./
COPY --from=builder /app/shared ../shared
RUN npm install --omit=dev

# Copy compiled server code and database schema
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/src/db/schema.sql ./dist/db/schema.sql
COPY --from=builder /app/server/src/db/schema.sql ./src/db/schema.sql

# Copy built frontend assets for Fastify to serve
COPY --from=builder /app/web/dist ../web/dist

EXPOSE 3050
ENV PORT=3050
ENV HOST=0.0.0.0

CMD ["node", "dist/index.js"]
