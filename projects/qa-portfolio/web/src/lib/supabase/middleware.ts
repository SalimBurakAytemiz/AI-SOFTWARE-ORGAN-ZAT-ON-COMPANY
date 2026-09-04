import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/db/database.types";

/**
 * MIDDLEWARE OTURUM YENİLEME (@supabase/ssr standart deseni).
 *
 * İŞ KURALI (planning/10 §10.3, katman 1): Middleware GÜVENLİK SINIRI DEĞİLDİR.
 * Yalnızca (a) Supabase oturum çerezini tazeler, (b) /admin/** için oturum
 * YOKSA erken eleme yapıp /admin/login'e yönlendirir. Asıl yetki kararı
 * (`is_admin()` allow-list) korumalı layout'ta ve RLS'te verilir.
 *
 * Edge runtime: @/lib/env (zod ağı) çekilmez; anahtarlar process.env'den
 * doğrudan okunur (anahtar adları src/lib/env.ts ile aynı kalmalı).
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  hasSession: boolean;
}> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return { response, hasSession: false };
  }

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[],
      ) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() çerez imzasını Supabase Auth sunucusuna doğrulatır (getSession'a
  // güvenilmez - planning/10 §10.3).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, hasSession: user !== null };
}
