import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  envDir: fileURLToPath(new URL("../../", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      "@kr-geo-guess/shared": fileURLToPath(new URL(
        "../../packages/shared/src/index.ts",
        import.meta.url,
      )),
    },
  },
});
