import { defineConfig } from "cypress";
import { readFileSync } from "fs";
import { resolve } from "path";

// Lee variables de un archivo .env sencillo (KEY=valor) sin dependencias externas.
function readEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(resolve(process.cwd(), file), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
  } catch {
    // Sin .env.local (p. ej. en CI): se usan las variables del sistema
  }
  return out;
}

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? "http://localhost:3000",
    // >= lg (1024px) → se renderiza el sidebar de carrito (desktop), más estable
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 8000,
    setupNodeEvents(on, config) {
      // Credenciales del admin: primero .env.local, luego variables del sistema
      const envLocal = readEnvFile(".env.local");
      config.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? envLocal.ADMIN_EMAIL;
      config.env.ADMIN_PASSWORD =
        process.env.ADMIN_PASSWORD ?? envLocal.ADMIN_PASSWORD;
      config.env.ADMIN_PIN = process.env.ADMIN_PIN ?? envLocal.ADMIN_PIN;
      return config;
    },
  },
});
