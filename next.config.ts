import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// Pin Turbopack to this app — a stray ~/package-lock.json was making Next
 // watch the whole home folder and full-refresh the browser in a loop.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents conflicts with route `runtime` exports used by some APIs
  // cacheComponents: true,
  // partialPrefetching: true,
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "rnzwdvcwrztwjmkpmdwg.supabase.co",
      },
      // Legacy DB covers — UI remaps these to local Indian stock when possible
      {
        protocol: "https",
        hostname: "randomuser.me",
      },
    ],
  },
  turbopack: {
    root: projectRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
