# Tayyar production image — gateway + prebuilt frontend
# Run API separately (see docker-compose) or point BACKEND_HOST to your API service.

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5173
ENV BACKEND_HOST=api
ENV BACKEND_PORT=8000

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY server.mjs ./
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:5173/health || exit 1

CMD ["node", "server.mjs"]
