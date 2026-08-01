import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

/**
 * Two build targets share one config:
 *   `vite build`                    -> the embeddable library in dist/
 *   `BUILD_TARGET=demo vite build`  -> the standalone demo site in dist-demo/
 */
const isDemo = process.env.BUILD_TARGET === "demo";

export default defineConfig({
  plugins: [react(), ...(isDemo ? [] : [dts({ include: ["src"], exclude: ["src/demo"], rollupTypes: true })])],
  build: isDemo
    ? {
        outDir: "dist-demo",
        emptyOutDir: true,
      }
    : {
        outDir: "dist",
        emptyOutDir: true,
        lib: {
          entry: resolve(__dirname, "src/index.ts"),
          name: "AmbienceConsole",
          fileName: (format) => (format === "es" ? "ambience-console.js" : "ambience-console.cjs"),
          formats: ["es", "cjs"],
        },
        rollupOptions: {
          external: ["react", "react-dom", "react/jsx-runtime", "lucide-react"],
          output: {
            globals: {
              react: "React",
              "react-dom": "ReactDOM",
            },
          },
        },
      },
});
