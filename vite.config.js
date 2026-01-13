import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: [
      "2748-103-47-74-66.ngrok-free.app", // Added new ngrok host
      // keep any existing allowed hosts here
    ],
    // optimizeDeps: {
    //   exclude: ["@yudiel/react-qr-scanner"],
    // },
    // proxy: {
    //   "/api": {
    //     target: "http://localhost:3001", // Point to your proxy2 server instead of direct to camu.in
    //     changeOrigin: true,
    //     secure: false,
    //   },
    // },
  },
  assetsInclude: ["**/*.wasm"],
});
