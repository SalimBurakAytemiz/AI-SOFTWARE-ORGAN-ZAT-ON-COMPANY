import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { env } from "@/lib/env";

/**
 * PUBLIC (anonim) OKUMA İSTEMCİSİ - oturum çerezi OKUMAZ.
 *
 * İŞ KURALI (planning/10 §10.3, §10.11): Public site içeriği kimliksiz servis
 * edilir. Bu istemci publishable anahtarı kullanır ve `anon` rolüyle çalışır;
 * gördüğü tek şey RLS'in `anon`'a açtığıdır (yayınlanmış + görünür içerik).
 * Çerez okumadığı için bu istemciyle yapılan sorgular Next.js tarafından
 * önbelleğe alınabilir / statik üretilebilir (createClient (server.ts) `cookies()`
 * çağırdığı için sayfayı dinamik yapardı - onu yalnızca admin/authenticated
 * yollar kullanır).
 *
 * Yazma yolu YOKTUR: içerik yönetimi authenticated server action'lar üzerinden,
 * admin RLS politikalarıyla yapılır.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
