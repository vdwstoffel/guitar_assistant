FROM node:20-alpine

# Install openssl for Prisma, ghostscript for PDF conversion, ffmpeg for video processing, and yt-dlp for YouTube imports
RUN apk add --no-cache openssl ghostscript ffmpeg python3 && \
    wget -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Make entrypoint executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
