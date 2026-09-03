/**
 * DENETİM (audit) KAYDI - append-only (planning/02 §2.4, planning/10 §10.4).
 *
 * Her admin içerik işlemi (create/update/publish/unpublish/hide/archive/restore/
 * delete/reorder/upload) buraya bir satır yazar. Kayıtlar SİLİNMEZ/DEĞİŞTİRİLMEZ.
 *
 * Faz 2: in-memory mock (tek sunucu süreci içinde). Faz 3: content_audit tablosu
 * (RLS: admin INSERT + SELECT, UPDATE/DELETE politikası yok).
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
  record(entry: Omit<AuditEntry, "id" | "createdAt">): Promise<AuditEntry>;
  list(limit?: number): Promise<AuditEntry[]>;
}

/** Faz 2 - in-memory, kalıcı değil. */
class InMemoryAuditRepository implements AuditRepository {
  private entries: AuditEntry[] = [];
  private seq = 0;

  async record(entry: Omit<AuditEntry, "id" | "createdAt">): Promise<AuditEntry> {
    const full: AuditEntry = {
      ...entry,
      id: ++this.seq,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(full);
    return full;
  }

  async list(limit = 50): Promise<AuditEntry[]> {
    return [...this.entries].reverse().slice(0, limit);
  }
}

let repo: AuditRepository | null = null;

export function getAuditRepository(): AuditRepository {
  // Faz 3: isSupabaseConfigured -> SupabaseAuditRepository (content_audit tablosu).
  if (!repo) repo = new InMemoryAuditRepository();
  return repo;
}
