# Node 22+ is required so yt-dlp can use Node as a JavaScript runtime for YouTube
# extraction (its Node EJS runtime needs >= 22.0.0, and reports older Node as
# "unsupported"). Without a JS runtime yt-dlp cannot solve YouTube's "n challenge"
# and formats come back missing ("Requested format is not available").
FROM node:22-alpine

# Install openssl for Prisma, ghostscript for PDF conversion, ffmpeg for video processing, and yt-dlp for YouTube imports
RUN apk add --no-cache openssl ghostscript ffmpeg python3 && \
    wget -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# System-wide yt-dlp config, applied to every invocation (all 4 call sites) so no
# per-call code changes are needed. Two settings, both required for YouTube:
#   --js-runtimes node   Node is not enabled as a JS runtime by default even when
#                        present (only deno is), so it must be turned on explicitly.
#   player_client        The default client chain falls back to "android vr", whose
#                        googlevideo (GVS) media URLs YouTube now rejects with
#                        HTTP 403 Forbidden. Most other clients require a GVS PO
#                        Token, and web/web_safari are SABR-only (formats have no
#                        URL). web_embedded still returns plain HTTP URLs without a
#                        PO Token; "default" is kept as a fallback.
RUN printf -- '--js-runtimes node\n--extractor-args "youtube:player_client=web_embedded,default"\n' > /etc/yt-dlp.conf

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Make entrypoint executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
