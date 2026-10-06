import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { localCodexPlugin } from "./server/codex-sessions.mjs";
import { officeImportPlugin } from "./server/office-import.mjs";
import { codexDoctorPlugin } from "./server/codex-doctor.mjs";
export default defineConfig({
  plugins: [react(), localCodexPlugin(), officeImportPlugin(), codexDoctorPlugin()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
