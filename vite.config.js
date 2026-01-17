import { randomUUID } from "crypto";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const appVersion = process.env.APP_VERSION || randomUUID();

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
});
