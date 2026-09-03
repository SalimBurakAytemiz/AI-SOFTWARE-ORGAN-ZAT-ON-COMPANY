import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Public site geneli yükleme durumu (planning genel: loading/empty/error).
 * Daha spesifik loading.tsx (ör. projects/) bunu ezer.
 */
export default function SiteLoading() {
  return (
    <section className="py-14">
      <Container>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-4 h-4 w-96 max-w-full" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        <div className="mt-10 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Container>
    </section>
  );
}
