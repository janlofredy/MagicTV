# Stage 1: Build client React frontend
FROM node:22-alpine AS client-builder
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm install --workspace=client
COPY client ./client
RUN npm --workspace=client run build

# Stage 2: Build server TypeScript & Prisma
FROM node:22-alpine AS server-builder
WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm install --workspace=server
COPY server ./server
RUN npm --workspace=server run db:generate
RUN npm --workspace=server run build

# Stage 3: Minimal Production Runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8000
ENV DATABASE_URL="file:/data/magictv.db"

# Install OpenSSL for Prisma engine on Alpine
RUN apk add --no-cache openssl libc6-compat && mkdir -p /data

COPY package*.json ./
COPY server/package*.json ./server/
RUN npm install --workspace=server --omit=dev

COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/prisma ./server/prisma
COPY --from=server-builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=server-builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=client-builder /app/client/dist ./client/dist

WORKDIR /app/server
EXPOSE 8000

VOLUME ["/data"]

CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma && node dist/index.js"]
