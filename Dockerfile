FROM oven/bun AS base

# STAGE 1. PACKAGES
#Install dependencies only when needed
FROM base AS deps
WORKDIR /app
# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# STAGE 2. BUILD
# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# use local variables as production (needed when testing locally)
RUN mv -n .env.local .env.production || true
RUN bun --bun run build

# STAGE 3. RUN
# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /data ./data
# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:bun .next
COPY --from=builder --chown=nextjs:bun /app/.next/standalone ./
COPY --from=builder --chown=nextjs:bun /app/.next/static ./.next/static

USER nextjs

# Volume to cache larger SAMS responses which are above the NextJS cache limit of 2MB
VOLUME ["/.temp/sams", "/data"]

EXPOSE 3000

ENV PORT 3000
# Set hostname to localhost
ENV HOSTNAME "0.0.0.0"
HEALTHCHECK NONE

CMD ["bun", "server.js"]