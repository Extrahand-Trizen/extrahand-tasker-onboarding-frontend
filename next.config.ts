import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML/CSS/JS for MinIO / CDN hosting (upload the `out/` folder)
  output: "export",
  trailingSlash: true,
  // Relative asset URLs for MinIO subfolder (…/build-001/index.html → ./_next/…)
  assetPrefix: "./",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
