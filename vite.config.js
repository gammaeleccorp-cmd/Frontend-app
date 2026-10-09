import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { validateProductionConfig } from "./scripts/production-config.mjs";

export default defineConfig(({ command, mode }) => {
  if (command === 'build') validateProductionConfig({ ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env });
  return { plugins: [react()] };
});
