FROM node:20-alpine
WORKDIR /app

ENV TZ=Asia/Tashkent
ENV NODE_ENV=production

RUN apk add --no-cache tzdata curl

# Dependencies o'rnatish
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Bot kodi
COPY . .

RUN mkdir -p logs

# Non-root user
RUN addgroup -S botgroup && adduser -S botuser -G botgroup \
 && chown -R botuser:botgroup /app
USER botuser

EXPOSE 3000
CMD ["node", "index.js"]
