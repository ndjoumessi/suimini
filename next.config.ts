import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't infer a parent dir from stray lockfiles.
  turbopack: { root: __dirname },
  // Hide the dev-mode on-screen indicator (bottom-left "N"): it overlaps the
  // mobile BottomNav during local dev. Dev-only; production was never affected.
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
