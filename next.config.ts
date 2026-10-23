import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Identifica la versión desplegada; la estación de impresión se recarga si cambia.
    NEXT_PUBLIC_BUILD_ID: process.env.COMMIT_REF ?? process.env.DEPLOY_ID ?? String(Date.now()),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;
