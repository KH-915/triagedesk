# Build context must be the repo root:  docker build -f services/api/Dockerfile .
FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY services/api/package.json services/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY prisma prisma
COPY services/api services/api
RUN npx prisma generate --schema=prisma/schema.prisma && npm --workspace=services/api run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/prisma prisma
COPY --from=build /app/services/api/dist services/api/dist
COPY --from=build /app/services/api/package.json services/api/
EXPOSE 4000
# Apply migrations, then start. Secrets (DATABASE_URL, JWT_SECRET) come from the environment.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node services/api/dist/server.js"]
