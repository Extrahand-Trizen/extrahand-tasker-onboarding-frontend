# ---------------- BASE ----------------
    FROM node:20-alpine AS base

    RUN apk add --no-cache dumb-init curl
    
    WORKDIR /app
    
    RUN addgroup -g 1001 -S nodejs && \
        adduser -S nextjs -u 1001
    
    
    # ---------------- DEPENDENCIES ----------------
    FROM base AS deps
    
    COPY package.json package-lock.json* ./
    
    RUN npm ci --no-audit --no-fund
    
    
    # ---------------- BUILDER ----------------
    FROM base AS builder
    
    # 🚨 THIS ARG CONTROLS CACHE INVALIDATION
    ARG CACHE_BUST
    
    # Make Docker consider this layer unique
    RUN echo "CACHE_BUST=${CACHE_BUST}"
    
    ENV NEXT_TELEMETRY_DISABLED=1
    
    COPY --from=deps /app/node_modules ./node_modules
    
    # 🚨 COPY CODE AFTER CACHE_BUST
    COPY . .
    
    RUN npm run build
    
    
    # ---------------- PRODUCTION ----------------
    FROM node:20-alpine AS production
    

    WORKDIR /app
    
    ENV NODE_ENV=production
    ENV PORT=3000
    ENV HOST=0.0.0.0
    ENV NEXT_TELEMETRY_DISABLED=1
    
    RUN apk add --no-cache dumb-init curl
    
    RUN addgroup -g 1001 -S nodejs && \
        adduser -S nextjs -u 1001
    
    COPY --from=builder /app/.next/standalone ./
    COPY --from=builder /app/.next/static ./.next/static
    COPY --from=builder /app/public ./public
    
    USER nextjs
    
    EXPOSE 3000
    
    ENTRYPOINT ["dumb-init", "--"]
    CMD ["node", "server.js"]