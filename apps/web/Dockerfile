# Build context must be the repo root:  docker build -f apps/web/Dockerfile .
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY services/api/package.json services/api/
RUN npm ci
COPY apps/web apps/web
RUN npm --workspace=apps/web run build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
