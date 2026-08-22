import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma", "@qvac/sdk", "pdf-parse", "tesseract.js", "mammoth"],
};

export default nextConfig;
