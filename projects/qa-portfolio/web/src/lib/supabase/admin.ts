import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { env } from "@/lib/env";

/**
 * ⚠️ SERVICE-ROLE İSTEMCİSİ - RLS'İ BYPASS EDER.
 *
 * Bu modül YALNIZCA şu dar amaçlar için vardır (planning/10 §10.4):
 *   - Admin için taslak (draft) önizleme okuması,
 *   - Storage bakım işlemleri,
 *   - İlk seed.
 *
 * Kurallar:
 *   - "server-only" importu: bu modül bir istemci paketine girerse DERLEME
 *     HATASI verir.
 *   - eslint no-restricted-imports kuralı bu modülün rastgele import edilmesini
 *     engeller (eslint.config.mjs).
 *   - Anahtar yalnızca SUPABASE_SERVICE_ROLE_KEY adıyla, sunucuda okunur;
 *     asla NEXT_PUBLIC_ önekiyle tanımlanmaz, asla loglanmaz.
 *
 * Faz 2: gerçek anahtar .env.local'e girilene kadar bu istemci çağrıldığında
 * anlaşılır bir hata fırlatır.
 */
export function createAdminClient() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "service-role istemcisi yapılandırılmamış: SUPABASE_SERVICE_ROLE_KEY gerekli (bir insan işlemi - bkz. supabase/README.md).",
    );
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
