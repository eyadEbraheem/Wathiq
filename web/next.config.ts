import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions forward uploaded photos to the API (max 10 MB each, a few per form).
    serverActions: { bodySizeLimit: "40mb" },
    // Keep visited and prefetched pages in the browser for 5 minutes, so going back to a page is
    // instant. Server Actions that change data still refresh it right away (revalidatePath).
    staleTimes: { dynamic: 300, static: 300 },
  },
};

export default nextConfig;
