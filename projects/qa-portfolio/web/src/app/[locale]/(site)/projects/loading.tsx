import { Container } from "@/components/ui/container";
import { Skeleton, CardGridSkeleton } from "@/components/ui/skeleton";

/**
 * Projeler sayfası yükleme durumu (planning/07 T-0305, planning genel: empty/
 * loading/error states). RSC veri beklerken gösterilir.
 */
export default function ProjectsLoading() {
  return (
    <section className="py-14">
      <Container>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-3 h-4 w-80" />
        <div className="mt-10">
          <CardGridSkeleton />
        </div>
      </Container>
    </section>
  );
}
