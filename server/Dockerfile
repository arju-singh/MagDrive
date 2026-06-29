# MagDrive API — long-running container (NOT serverless: ffmpeg/sharp/pdf
# thumbnailing, HTTP Range streaming, and in-memory queues need a real process).
FROM node:22-slim

# ffmpeg for video thumbnails (sharp & pdf-to-img ship their own binaries).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# DB_DRIVER=postgres + DATABASE_URL (Neon) supplied via the host's env/secrets.
CMD ["node", "src/index.js"]
