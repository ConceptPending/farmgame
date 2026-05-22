import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@farmgame/engine", "@farmgame/renderer", "@farmgame/shared"],
  // The pixi.js canvas owns a single WebGL context + a shared tileset texture
  // cache; StrictMode's dev double-mount races two renderers on one canvas and
  // corrupts the textures. One renderer per mount is correct here.
  reactStrictMode: false,
};

export default nextConfig;
