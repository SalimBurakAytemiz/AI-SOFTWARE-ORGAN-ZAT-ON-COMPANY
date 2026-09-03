import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    rules: {
      // "_" ile başlayan parametreler bilerek kullanılmıyor sayılır (iskelet metotlar).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // GÜVENLİK KURALI: Supabase service-role istemcisi (RLS'i bypass eder)
      // yalnızca src/lib/supabase/admin.ts içinde ve sunucu kodunda kullanılabilir.
      // Bu kural, service-role modülünün istemci (client) bileşenlerine veya
      // rastgele yerlere import edilmesini engeller (planning/10 §10.4, review R2/RISK-002).
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase/admin", "**/lib/supabase/admin"],
              message:
                "service-role istemcisi yalnızca sunucu tarafı yardımcı modüllerde kullanılabilir; istemci bileşenine import etmeyin.",
            },
          ],
        },
      ],
    },
  },
];

export default config;
