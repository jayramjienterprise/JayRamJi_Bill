# Multi-stage Dockerfile optimized for Vercel Container Runtime with Puppeteer & System Chromium
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Prevent Puppeteer from attempting automatic browser download during build
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy package definition and TypeScript configuration
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies needed for compiling TypeScript)
RUN npm ci

# Copy backend source code
COPY src ./src

# Compile TypeScript to dist
RUN npm run build

# ----------------------------------------------------
# Production Runner Image
# ----------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install system Chromium, fonts, and execution dependencies for headless document generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && which chromium \
    && chromium --version

# Copy package files
COPY package*.json ./

# Install only production dependencies without downloading browser binaries
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript output from builder stage
COPY --from=builder /app/dist ./dist

# Vercel provides dynamic PORT at runtime
EXPOSE 5000

# Start the Express server directly with Node
CMD ["node", "dist/server.js"]
