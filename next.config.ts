import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML/CSS/JS for MinIO / CDN hosting (upload the `out/` folder)
  // Docker sets NEXT_OUTPUT=standalone because its image runs Next's server.js.
  output: process.env.NEXT_OUTPUT === "standalone"
    ? "standalone"
    : process.env.NODE_ENV === "development"
      ? undefined
      : "export",
  trailingSlash: true,
  // Relative URLs are needed only for MinIO subfolder exports. Standalone
  // Docker builds serve Next assets from the root /_next path.
  assetPrefix:
    process.env.NEXT_OUTPUT === "standalone" || process.env.NODE_ENV === "development"
      ? undefined
      : "./",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
