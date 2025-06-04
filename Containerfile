FROM oven/bun:1.2-alpine AS base
RUN apk update && apk add curl --no-cache

# STEP 1: install dependenceis
# - define the step
# - set the working directory
# - copy the package.json and lockfile
# - install the dependencies
FROM base AS dependencies
WORKDIR /app
# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# STEP 2: build the application
# - define the step
# - set the working directory
# - copy the dependencies from the previous step
# - merge env files (this is used in dev only because in production they are set as secrets)
FROM base AS builder
WORKDIR /app
ENV TZ=Europe/Berlin
ENV NODE_ENV=production
ENV DOCKER_BUILD=true
ENV SENTRY_ENVIRONMENT=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN bun run build

# STEP 3: run the application
# - define the step
# - set the working directory
# - set the enviroment to production (so NextJs uses minification and etc.)
# - create a group and a user for it
# - set the correct permission for prerender cache
# - copy the files from the previous step and grand the user permission
# - copy the public files (e.g. images)
# - merge env files (only used for dev)
# - set the username, ports, hostname and finally run the app
FROM base AS runner
WORKDIR /app
ENV TZ=Europe/Berlin
ENV NODE_ENV=production
ENV SENTRY_ENVIRONMENT=production
RUN addgroup -S vcmuellheim && adduser -S -G vcmuellheim spieler
RUN mkdir -p .next/cache
RUN chown -R spieler:vcmuellheim .next
COPY --from=builder --chown=spieler:vcmuellheim /app/.next/standalone ./
COPY --from=builder --chown=spieler:vcmuellheim /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/data/migrations ./data/migrations

USER spieler
EXPOSE 3080
ENV PORT=3080
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --start-period=5s --interval=2m --timeout=3s \
    CMD curl -f http://localhost:3080/ || exit 1

CMD ["bun", "--env-file", ".env", "start"]

LABEL org.opencontainers.image.source=https://github.com/terijaki/vcmuellheim