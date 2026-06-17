import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so the build works on GitHub Pages under any repo name
  // (e.g. username.github.io/our-space/) without further configuration.
  base: "./",
  plugins: [react()],
});
