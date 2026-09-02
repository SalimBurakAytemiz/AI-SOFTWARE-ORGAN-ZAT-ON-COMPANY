import { NextResponse } from "next/server";
import { contactSubmissionSchema, looksAutomated } from "@/lib/validation/contact";
import { env } from "@/lib/env";

/**
 * POST /api/contact - iletişim formu gönderimi (planning/03, planning/10 §10.8).
 *
 * Sıra:
 *   1. Gövdeyi contactSubmissionSchema ile doğrula (istemciyle AYNI şema + bot alanları).
 *   2. honeypot / süre kontrolü -> bot ise sessizce "başarılı" dön (oracle sızıntısı yok).
 *   3. (FAZ 2) IP-hash bazlı hız sınırı + veritabanı INSERT (RLS: anon INSERT) + DB tetikleyici.
 *   4. (FAZ 2) Mailer ile bildirim e-postası (kullanıcı girdisi metin olarak, HTML olarak DEĞİL).
 *
 * FAZ 1: e-posta sağlayıcısı yapılandırılmadığı için gerçek gönderim yapılmaz.
 * Yapılandırma yoksa 503 döner; hata mesajı altyapı ayrıntısı sızdırmaz.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = contactSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Bot koruması: honeypot dolu veya çok hızlı gönderim -> sessizce yok say.
  if (looksAutomated(parsed.data)) {
    // Bilerek 200: bir bota "yakalandın" sinyali verilmez.
    return NextResponse.json({ ok: true });
  }

  const mailerConfigured = Boolean(env.MAIL_PROVIDER_API_KEY) && Boolean(env.MAIL_TO_ADDRESS);
  if (!mailerConfigured) {
    // Faz 1: bir insan işlemi gerekli (e-posta sağlayıcısı + hesap). Bkz. supabase/README.md.
    return NextResponse.json(
      { ok: false, reason: "not_configured" },
      { status: 503 },
    );
  }

  // FAZ 2: hız sınırı + contact_messages INSERT + Mailer.send(...) burada.
  return NextResponse.json({ ok: true });
}
