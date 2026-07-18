import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  // pdf-parse's worker file is only referenced via a dynamically-built path,
  // so Next's file tracer can miss it when deploying — force it in explicitly.
  outputFileTracingIncludes: {
    "/*": ["node_modules/pdf-parse/dist/worker/**/*"],
  },
};

export default nextConfig;
