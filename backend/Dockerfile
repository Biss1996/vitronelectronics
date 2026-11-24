FROM oven/bun:1-alpine

WORKDIR /app
ENV NODE_ENV=production

# No runtime dependencies yet — everything uses Bun built-ins.
# If you add packages later, uncomment these two lines:
# COPY package.json bun.lock ./
# RUN bun install --frozen-lockfile --production

COPY migrations ./migrations
COPY scripts ./scripts
COPY src ./src
COPY package.json ./

USER bun
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:${PORT:-4000}/api/health || exit 1

CMD ["bun", "src/index.js"]
