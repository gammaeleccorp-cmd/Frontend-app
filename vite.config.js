import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// CI builds the immutable artifact with its exact source identity. Local dev
// builds have no production release identity and do not offer release updates.
const release = process.env.GITHUB_SHA || "development";
if (process.env.GITHUB_SHA && !/^[a-f0-9]{40}$/.test(release)) throw new Error("Invalid frontend release SHA");

export default defineConfig({
  define: { __GAMMA_RELEASE__: JSON.stringify(release) },
  plugins: [react(), {
    name: "gamma-release-identity",
    transformIndexHtml() {
      return [{ tag: "meta", attrs: { name: "gamma-release", content: release }, injectTo: "head" }];
    },
  }],
});
