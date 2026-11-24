# Production Dockerfile for SoundCache API & Web UI
FROM node:20-alpine

WORKDIR /app

# Copy API package definitions
COPY api/package*.json ./api/

# Install dependencies in api directory
RUN cd api && npm install --omit=dev

# Copy application code
COPY api ./api

WORKDIR /app/api

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "index.js"]

