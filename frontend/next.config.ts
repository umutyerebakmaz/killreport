import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `next dev` and `next build` share one output directory and corrupt each
  // other's work, which is why `build` used to kill whatever held port 3000 —
  // the dev server. A verification build sets NEXT_DIST_DIR and writes
  // somewhere else instead, so the two can run at once. Unset, this is the
  // default and production builds are unaffected.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.evetech.net',
        pathname: '/**',
      },
    ],
    // `search` is deliberately unset. The docs' example pins it to '' — no
    // query string — and every URL we build carries one (`?size=128`), so
    // pinning it would reject all of them.
  },

  experimental: {
    // RSC isteklerini azalt
    staleTimes: {
      dynamic: 30, // 30 saniye client-side cache
      static: 180, // 3 dakika static cache
    },
  },
};

export default nextConfig;
