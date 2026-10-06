import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { localCodexPlugin } from "./server/codex-sessions.mjs";
export default defineConfig({
  plugins: [react(), localCodexPlugin()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
