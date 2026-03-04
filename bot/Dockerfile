# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Tashkent vaqt zonasi
ENV TZ=Asia/Tashkent
RUN apk add --no-cache tzdata

# Dependencies builder dan ko'chirish
COPY --from=builder /app/node_modules ./node_modules

# Bot kodi
COPY . .

# Logs papkasi
RUN mkdir -p logs

# Non-root user
RUN addgroup -S botgroup && adduser -S botuser -G botgroup \
 && chown -R botuser:botgroup /app
USER botuser

CMD ["node", "index.js"]
