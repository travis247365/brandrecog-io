# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY tsconfig.json ./
COPY shared ./shared
COPY server ./server
# Bundle the server (express included) into a single dependency-free file.
RUN npx esbuild server/index.ts --bundle --platform=node --format=cjs --target=node20 --outfile=dist/index.js

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 MOCK=1
COPY --from=builder /app/dist ./dist
COPY public ./public
COPY server/data ./server/data
EXPOSE 3000
CMD ["node", "dist/index.js"]
