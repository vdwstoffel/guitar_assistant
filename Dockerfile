FROM node:20-alpine

# Install openssl for Prisma and ghostscript for PDF conversion
RUN apk add --no-cache openssl ghostscript

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Make entrypoint executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
