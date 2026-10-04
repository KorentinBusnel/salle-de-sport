import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les packages du monorepo sont publiés en TypeScript source.
  transpilePackages: ["@salle/shared", "@salle/supabase", "@salle/ui"],
};

export default nextConfig;
