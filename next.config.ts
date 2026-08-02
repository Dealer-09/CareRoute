import type { NextConfig } from "next";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000'

const nextConfig: NextConfig = {
  transpilePackages: ['@careroute/core'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://raw.githubusercontent.com https://unpkg.com",
              `connect-src 'self' ${backendUrl} blob: https://nominatim.openstreetmap.org https://overpass-api.de`,
              "font-src 'self' data:",
              "worker-src 'self' blob:",
            ].join('; ')
          }
        ]
      }
    ]
  }
};

export default nextConfig;
