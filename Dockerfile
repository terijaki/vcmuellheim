FROM oven/bun AS base

ARG SAMS_CACHE=/.temp/sams
ENV SAMS_CACHE=$SAMS_CACHE

# STAGE 1. PACKAGES
#Install dependencies only when needed
FROM base AS dependencies
WORKDIR /app
# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# STAGE 2. BUILD
# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
# use local variables as production (needed when testing locally)
RUN mv -n .env.development.local .env.production || true
RUN bun --bun run build

# STAGE 3. RUN
# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data
COPY --from=builder $SAMS_CACHE $SAMS_CACHE
# RUN mkdir .next
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3080
ENV PORT 3080
ENV HOSTNAME "0.0.0.0"

HEALTHCHECK NONE

CMD ["bun", "server.js"]