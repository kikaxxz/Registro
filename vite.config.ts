import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "icons/*.png"],
      manifest: {
        name: "Registro · Electricidad",
        short_name: "Registro",
        lang: "es",
        description: "Asistencia del personal del área de Electricidad",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#172522",
        background_color: "#f4f6f5",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        // Only the application shell is cached; Firebase responses are not.
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/@firebase/") || id.includes("/firebase/"))
            return "firebase";
        },
      },
    },
  },
});
