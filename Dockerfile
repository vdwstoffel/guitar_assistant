# Node 22+ is required so yt-dlp can use Node as a JavaScript runtime for YouTube
# extraction (its Node EJS runtime needs >= 22.0.0). Without a JS runtime yt-dlp
# falls back to the JS-less "android vr" client, which YouTube intermittently
# blocks with HTTP 403 Forbidden.
FROM node:22-alpine

# Install openssl for Prisma, ghostscript for PDF conversion, ffmpeg for video processing, and yt-dlp for YouTube imports
RUN apk add --no-cache openssl ghostscript ffmpeg python3 && \
    wget -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Enable Node as yt-dlp's JavaScript runtime for every invocation (system-wide
# config). Node is not enabled by default even when present, so this is required
# alongside the Node 22+ base image above to keep YouTube downloads reliable.
RUN printf -- '--js-runtimes node\n' > /etc/yt-dlp.conf

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Make entrypoint executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
