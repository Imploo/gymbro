import { randomUUID } from "crypto";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const appVersion = process.env.APP_VERSION || randomUUID();

export default defineConfig(({ mode }) => {
  const isE2E = process.env.VITE_E2E === "true";

  return {
    plugins: [vue()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      hmr: isE2E ? undefined : {
        clientPort: 5173,
      },
      watch: {
        usePolling: true,
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
  };
});
