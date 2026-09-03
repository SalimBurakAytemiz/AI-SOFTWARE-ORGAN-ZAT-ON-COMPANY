import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/database.types";
import { env } from "@/lib/env";

/**
 * Tarayıcı (istemci bileşenleri) için Supabase istemcisi.
 *
 * Bu istemci PUBLISHABLE anahtarı kullanır (Supabase'in eski "anon key"i).
 * Anahtarın gücü tamamen Row Level Security (RLS) ile sınırlıdır - bu yüzden
 * istemciye gömülmesi güvenlidir (planning/10 §10.11). Yazma yolları yoktur;
 * içerik yönetimi server action'lar üzerinden yapılır.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
  );
}
