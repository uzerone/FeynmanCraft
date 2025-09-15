import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/app/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      // Proxy ADK API requests to the backend server
      "/list-apps": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/apps": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/run": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/run_sse": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      // Proxy LaTeX MCP requests to avoid CORS issues
      "/latex-mcp": {
        target: "http://127.0.0.1:8003",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/latex-mcp/, ""),
      },
    },
  },
});
