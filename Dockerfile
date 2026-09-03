FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    CRAWLEE_SKIP_BROWSER_INSTALL=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont fontconfig

ENV NODE_ENV=production \
    PORT=3000 \
    CHROME_PATH=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_DOWNLOAD=true \
    CRAWLEE_SKIP_BROWSER_INSTALL=1

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["node", "dist/main.js"]
