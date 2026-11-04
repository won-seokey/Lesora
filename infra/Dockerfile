FROM node:24.11.0-bookworm-slim AS base
WORKDIR /app
COPY . .
# Once a reviewed package-lock.json exists, use npm ci everywhere.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
FROM base AS api
USER node
CMD ["node", "apps/api/src/index.ts"]
FROM base AS web-build
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN npm run build -w @lesora/web
FROM web-build AS web
ENV NODE_ENV=production
USER node
CMD ["npm", "run", "start", "-w", "@lesora/web"]
