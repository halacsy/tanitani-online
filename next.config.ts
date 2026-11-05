import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import { getAllTags } from "./lib/content";
import { tagHref } from "./lib/tags.mjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep legacy IKT → ikt redirects from matching their lowercase destination.
  experimental: { caseSensitiveRoutes: true },
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
  async redirects() {
    return getAllTags().flatMap(name => {
      const destination = tagHref(name);
      const encoded = encodeURIComponent(name);
      // Include URLs copied from the previously encoded static parameters.
      return [...new Set([encoded, encodeURIComponent(encoded)])]
        .map(value => `/temakorok/${value}`)
        .filter(source => source !== destination)
        .map(source => ({ source, destination, permanent: true }));
    });
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/sites/default/files/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
};

export default nextConfig;
