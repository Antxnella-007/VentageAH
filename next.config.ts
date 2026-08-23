import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma", "unpdf", "tesseract.js", "mammoth"],
  outputFileTracingExcludes: {
    "*": [
      "agent-tools/**",
      "uploads/**",
      "prisma/dev.db",
      ".git/**",
      ".vercel/**",
    ],
  },
};

export default nextConfig;
