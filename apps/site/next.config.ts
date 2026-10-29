import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les packages du monorepo sont publiés en TypeScript source.
  transpilePackages: ["@salle/shared", "@salle/supabase", "@salle/ui"],
  // Les consignes pour agents vivent dans le CLAUDE.md racine : pas de fichiers générés.
  agentRules: false,
};

export default nextConfig;
