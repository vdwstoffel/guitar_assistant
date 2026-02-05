FROM node:20-alpine

# Install openssl for Prisma, ghostscript for PDF conversion, and ffmpeg for video processing
RUN apk add --no-cache openssl ghostscript ffmpeg

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Make entrypoint executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
