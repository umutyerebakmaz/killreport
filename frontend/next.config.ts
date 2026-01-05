import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // RSC isteklerini azalt
    staleTimes: {
      dynamic: 30, // 30 saniye client-side cache
      static: 180, // 3 dakika static cache
    },
  },
};

export default nextConfig;
