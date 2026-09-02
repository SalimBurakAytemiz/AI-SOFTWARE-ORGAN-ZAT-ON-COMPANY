import { redirect } from "next/navigation";

/**
 * /admin girişi. Kontrol panele yönlendirir; oturum/yetki yoksa
 * (protected) layout kullanıcıyı /admin/login'e gönderir.
 */
export default async function AdminIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/admin/dashboard`);
}
