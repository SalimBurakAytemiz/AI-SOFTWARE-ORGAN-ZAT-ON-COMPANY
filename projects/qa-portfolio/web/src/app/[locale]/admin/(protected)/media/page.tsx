import { AdminMediaRepository } from "@/lib/repositories/admin-media-repository";
import { MediaManager } from "@/components/admin/media-manager";

export const dynamic = "force-dynamic";

/**
 * Medya kütüphanesi (planning/05 §5.9). Gerçek `media` bucket + `media` tablosu.
 */
export default async function AdminMediaPage() {
  const repo = await AdminMediaRepository.create();
  const items = await repo.list();

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Medya</h1>
      <MediaManager items={items} />
    </div>
  );
}
