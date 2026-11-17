FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev && mkdir -p /app/data && chown -R node:node /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/app/data
USER node
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "server/index.mjs"]
