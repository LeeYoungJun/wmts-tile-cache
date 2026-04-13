FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV CONFIG_PATH=./config.yaml

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY config.yaml ./config.yaml

RUN mkdir -p cache && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
