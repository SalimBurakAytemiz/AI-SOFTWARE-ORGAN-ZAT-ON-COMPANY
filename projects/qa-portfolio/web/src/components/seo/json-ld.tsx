/**
 * JSON-LD structured data'yı sayfaya gömer.
 *
 * GÜVENLİK: içerik geliştirici tarafından üretilir (kullanıcı girdisi değil) ve
 * JSON.stringify ile kaçışlanır. `<` karakteri `<` olarak değiştirilir ki
 * bir string içindeki "</script>" render'ı bozmasın.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}
