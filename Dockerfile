FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/data
EXPOSE 3847
VOLUME ["/data"]
CMD ["npx", "tsx", "scripts/boot.ts"]
