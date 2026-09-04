import { isSupabaseConfigured } from "@/lib/env";

/**
 * DENETİM (audit) KAYDI - append-only (planning/02 §2.4, planning/10 §10.4).
 *
 * Her admin içerik işlemi (create/update/publish/unpublish/hide/archive/restore/
 * delete/reorder/upload) buraya bir satır yazar. Kayıtlar SİLİNMEZ/DEĞİŞTİRİLMEZ.
 *
 * - Supabase yapılandırılıysa: `content_audit` tablosu (RLS: admin INSERT +
 *   SELECT; UPDATE/DELETE politikası yok). `actor_user_id` DB varsayılanıyla
 *   `auth.uid()`; `actor_name` uygulamadan gelen görünen ad.
 * - Değilse (mock admin / test): in-memory (tek süreç, kalıcı değil).
 */
export interface AuditEntry {
  id: number;
  actorName: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  createdAt: string;
}

export interface AuditRepository {
  record(entry: Omit<AuditEntry, "id" | "createdAt">): Promise<void>;
  list(limit?: number): Promise<AuditEntry[]>;
}

/** Mock admin / test - in-memory, kalıcı değil. */
class InMemoryAuditRepository implements AuditRepository {
  private entries: AuditEntry[] = [];
  private seq = 0;

  async record(entry: Omit<AuditEntry, "id" | "createdAt">): Promise<void> {
    this.entries.push({ ...entry, id: ++this.seq, createdAt: new Date().toISOString() });
  }

  async list(limit = 50): Promise<AuditEntry[]> {
    return [...this.entries].reverse().slice(0, limit);
  }
}

/** Gerçek - content_audit tablosu (authenticated istemci, RLS admin INSERT). */
class SupabaseAuditRepository implements AuditRepository {
  async record(entry: Omit<AuditEntry, "id" | "createdAt">): Promise<void> {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    // actor_user_id: DB varsayılanı auth.uid() (0004_admin_rpcs.sql).
    const { error } = await supabase.from("content_audit").insert({
      actor_name: entry.actorName,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      action: entry.action,
      summary: entry.summary,
    });
    // Audit yazımı asıl işlemi geri almaz ama sessiz de geçilmez.
    if (error) {
      console.error("[audit] content_audit yazımı başarısız:", error.message);
      throw new Error(`audit yazımı başarısız: ${error.message}`);
    }
  }

  async list(limit = 50): Promise<AuditEntry[]> {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("content_audit")
      .select("id, actor_name, entity_type, entity_id, action, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`audit listeleme başarısız: ${error.message}`);
    return (data ?? []).map((r) => ({
      id: Number(r.id),
      actorName: r.actor_name,
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      summary: r.summary,
      createdAt: r.created_at,
    }));
  }
}

let repo: AuditRepository | null = null;

export function getAuditRepository(): AuditRepository {
  if (!repo) {
    const useMock = process.env.AI_COMPANY_MOCK_ADMIN === "1" || !isSupabaseConfigured;
    repo = useMock ? new InMemoryAuditRepository() : new SupabaseAuditRepository();
  }
  return repo;
}

/** Test izolasyonu için repo önbelleğini sıfırlar. */
export function _resetAuditRepository(): void {
  repo = null;
}
