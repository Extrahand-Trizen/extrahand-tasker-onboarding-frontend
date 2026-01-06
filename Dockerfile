# Use Node.js 20 LTS Alpine image (required for Next.js 16)
FROM node:20-alpine AS base

# Install security updates and necessary packages
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl && \
    rm -rf /var/cache/apk/*

# Create app directory with proper permissions
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Dependencies stage
FROM base AS dependencies

# Accept build cache buster argument
ARG CACHE_BUST=no-cache

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies (aggressive cache busting)
# Using timestamp to ensure fresh builds
RUN BUILD_TIMESTAMP=$(date -u +%Y%m%d%H%M%S) && \
    npm cache clean --force && \
    if [ -f package-lock.json ]; then \
      npm ci --prefer-offline=false && npm cache clean --force; \
    else \
      npm install --prefer-offline=false && npm cache clean --force; \
    fi && \
    echo "Cache bust: ${CACHE_BUST}" > /tmp/deps-cache-bust.txt && \
    echo "Build timestamp: ${BUILD_TIMESTAMP}" >> /tmp/deps-cache-bust.txt && \
    rm -rf /root/.npm /tmp/npm-* && \
    cat /tmp/deps-cache-bust.txt

# Builder stage
FROM base AS builder

# Accept build cache buster argument
ARG CACHE_BUST=no-cache
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID

# Set environment variables for Next.js build
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}
ENV NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}

# Copy dependencies from dependencies stage
COPY --from=dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy source code
COPY --chown=nextjs:nodejs . .

# ✨ CRITICAL: Add cache buster to force fresh code copy and build
RUN BUILD_TIMESTAMP=$(date -u +%Y%m%d%H%M%S) && \
    echo "Cache bust: ${CACHE_BUST}" > /tmp/cache-bust.txt && \
    echo "Build timestamp: ${BUILD_TIMESTAMP}" >> /tmp/cache-bust.txt && \
    echo "Source files count: $(find . -type f -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' | grep -v node_modules | wc -l)" >> /tmp/cache-bust.txt && \
    cat /tmp/cache-bust.txt

# Build Next.js application
RUN BUILD_TIMESTAMP=$(date -u +%Y%m%d%H%M%S) && \
    npm run build && \
    echo "Build completed at: ${BUILD_TIMESTAMP}" >> /tmp/cache-bust.txt && \
    cat /tmp/cache-bust.txt

# Production stage
FROM base AS production

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Note: The following environment variables should be set at runtime via CapRover:
# - NEXT_PUBLIC_API_URL
# - NEXT_PUBLIC_FIREBASE_API_KEY
# - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
# - NEXT_PUBLIC_FIREBASE_PROJECT_ID
# - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
# - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
# - NEXT_PUBLIC_FIREBASE_APP_ID

# Copy built application from builder stage
# Next.js standalone output creates a .next/standalone directory
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Remove unnecessary files
RUN rm -rf \
    .git \
    .gitignore \
    *.md \
    .dockerignore \
    Dockerfile \
    tsconfig.json \
    eslint.config.mjs \
    postcss.config.mjs \
    next.config.ts \
    node_modules/typescript \
    node_modules/@types

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# ✅ HEALTH CHECK
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the Next.js application
# With standalone output, server.js is in the root of the standalone directory
CMD ["node", "server.js"]
