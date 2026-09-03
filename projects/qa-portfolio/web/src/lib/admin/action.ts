import "server-only";
import { z } from "zod";
import { isAdmin } from "@/lib/auth/is-admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getAuditRepository } from "./audit";
import { revalidateContent, type ContentEntity } from "./revalidate";

/**
 * ADMIN MUTASYON ALTYAPISI (planning/07 T-0702, planning/05 §5.13).
 *
 * TÜM admin yazma işlemleri bu sarmalayıcıdan geçer. Sıra:
 *
 *   1. Authentication  -> oturum var mı? (Supabase yoksa: reddet)
 *   2. Authorization   -> is_admin() (allow-list); oturum açmak yetmez
 *   3. Validation      -> paylaşılan zod şeması (istemciyle aynı)
 *   4. Database write  -> verilen mutasyon fonksiyonu (repository)
 *   5. Audit           -> content_audit'e append-only kayıt
 *   6. Revalidation    -> etkilenen public etiketleri tazele
 *
 * Herhangi bir adım başarısız olursa yazma YAPILMAZ ve sınıflandırılmış bir
 * hata döner (altyapı ayrıntısı sızdırmadan).
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ActionErrorCode; message: string; fieldErrors?: Record<string, string[]> };

export type ActionErrorCode =
  | "NOT_CONFIGURED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "WRITE_FAILED";

export interface AdminActionContext {
  actorName: string;
}

export interface AdminActionOptions<TInput, TOutput> {
  /** İşlemin adı (audit action alanı). */
  action: string;
  /** Etkilenen varlık türü (revalidation). */
  entity: ContentEntity;
  /** Girdi doğrulama şeması (istemci + sunucu ortak). */
  schema: z.ZodType<TInput>;
  /** Asıl yazma işlemi (repository çağrısı). id + summary döndürür. */
  write: (input: TInput, ctx: AdminActionContext) => Promise<{ id: string; summary: string; data: TOutput }>;
}

export async function withAdminAction<TInput, TOutput>(
  rawInput: unknown,
  opts: AdminActionOptions<TInput, TOutput>,
): Promise<ActionResult<TOutput>> {
  // --- 0. Yapılandırma ---
  if (!isSupabaseConfigured) {
    // Faz 2: gerçek yazma için Supabase gerekli. Mock admin akışları
    // (in-memory) yalnızca test/geliştirme içindir ve bu bayrakla açılır.
    if (process.env.AI_COMPANY_MOCK_ADMIN !== "1") {
      return {
        ok: false,
        code: "NOT_CONFIGURED",
        message: "Bu işlem için Supabase yapılandırması gerekli (bir insan işlemi).",
      };
    }
  }

  // --- 1. Authentication + 2. Authorization ---
  const admin = await isAdmin().catch(() => false);
  const mockAdmin = process.env.AI_COMPANY_MOCK_ADMIN === "1";
  if (!admin && !mockAdmin) {
    return { ok: false, code: "FORBIDDEN", message: "Bu işlem için yönetici yetkisi gerekli." };
  }

  // --- 3. Validation ---
  const parsed = opts.schema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Girdi doğrulaması başarısız.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const ctx: AdminActionContext = { actorName: mockAdmin ? "mock-admin" : "owner" };

  // --- 4. Database write ---
  let result: { id: string; summary: string; data: TOutput };
  try {
    result = await opts.write(parsed.data, ctx);
  } catch (err) {
    return {
      ok: false,
      code: "WRITE_FAILED",
      message: err instanceof Error ? err.message : "Yazma işlemi başarısız.",
    };
  }

  // --- 5. Audit (append-only) ---
  await getAuditRepository().record({
    actorName: ctx.actorName,
    entityType: opts.entity,
    entityId: result.id,
    action: opts.action,
    summary: result.summary,
  });

  // --- 6. Revalidation ---
  revalidateContent(opts.entity, result.id);

  return { ok: true, data: result.data };
}
