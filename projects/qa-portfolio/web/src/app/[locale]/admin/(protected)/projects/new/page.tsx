import Link from "next/link";
import { NewProjectForm } from "@/components/admin/new-project-form";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <div>
      <Link href={`/${locale}/admin/projects`} className="text-sm text-[var(--text-muted)]">
        ← Projeler
      </Link>
      <h1 className="my-3 text-lg font-semibold">Yeni proje</h1>
      <NewProjectForm locale={locale} />
    </div>
  );
}
