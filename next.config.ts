import type { NextConfig } from "next";

// `STATIC_EXPORT=1 next build` → fully static site in ./out (GitHub Pages etc.)
// BASE_PATH=/repo-name for GitHub Pages project sites
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = staticExport ? (process.env.BASE_PATH ?? "") : "";

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" as const, images: { unoptimized: true } } : {}),
  basePath,
  // static export is written into distDir: "out" (also keeps it apart from a running `next dev`)
  distDir: staticExport ? (process.env.EXPORT_DIR ?? "out") : ".next",
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  devIndicators: { position: "bottom-right" },
  /* config options here */
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
