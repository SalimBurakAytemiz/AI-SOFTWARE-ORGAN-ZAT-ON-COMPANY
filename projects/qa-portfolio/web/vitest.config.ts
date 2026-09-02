import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Birim testleri için Vitest yapılandırması.
// Şu an yalnızca saf (pure) mantık test edilir: zod şemaları, publication
// predicate'i, slug yardımcıları. Entegrasyon/RLS testleri faz 2'de gerçek
// Postgres'e karşı eklenecek (planning/11-test-strategy.md §11.2).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
