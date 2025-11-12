import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";

export default defineConfig({
  server: {
    open: false,
  },
  plugins: [
    webExtension({
      manifest: "./manifest.json",
      skipManifestValidation: true,
      disableAutoLaunch: true,
    }),
  ],
});
