import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@farmgame/engine", "@farmgame/renderer", "@farmgame/shared"],
};

export default nextConfig;
