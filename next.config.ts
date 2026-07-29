import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@careroute/core'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org; connect-src 'self' http://localhost:4000 https://nominatim.openstreetmap.org https://overpass-api.de; font-src 'self' data:;"
          }
        ]
      }
    ]
  }
};

export default nextConfig;
