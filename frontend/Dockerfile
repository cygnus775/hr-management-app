FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies with build script approval
RUN pnpm install --frozen-lockfile && \
    pnpm approve-builds core-js sharp && \
    pnpm install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy necessary files from builder
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["pnpm", "start"] 