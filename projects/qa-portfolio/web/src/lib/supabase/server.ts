import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/database.types";
import { env } from "@/lib/env";

/**
 * Sunucu (RSC, route handler, server action) için Supabase istemcisi.
 *
 * Oturum çerezini okuyup yazar; kullanıcının oturumu bu istemci üzerinden
 * taşınır. YİNE de anonim/authenticated rolüyle çalışır ve RLS'e tabidir -
 * yani oturum açmış olmak tek başına yetki vermez (planning/10 §10.3).
 * Admin yetkisi ayrıca is_admin() ile doğrulanır (bkz. lib/auth/is-admin.ts).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL as string,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) {
          // RSC render'ı sırasında çerez yazılamaz; bu durumda sessizce geçilir.
          // Oturum yenileme middleware'de yapılır.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // yalnızca server action / route handler bağlamında yazılabilir
          }
        },
      },
    },
  );
}
