import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://onurkerem.github.io/auto-image-editor",
  vite: {
    plugins: [tailwindcss()],
  },
});
