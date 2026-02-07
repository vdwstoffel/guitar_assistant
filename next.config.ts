import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'fluent-ffmpeg',
    'music-metadata',
    'node-id3',
    'node-taglib-sharp',
    'wavefile',
  ],
};

export default nextConfig;
