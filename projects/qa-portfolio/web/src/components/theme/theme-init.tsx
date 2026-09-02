/**
 * Tema başlatıcı.
 *
 * Kullanıcının kayıtlı tema tercihini (localStorage: "qa-theme") sayfa
 * boyanmadan <html data-theme> üzerine uygular; böylece koyu/açık geçişte
 * yanıp sönme (FOUC) olmaz. Kayıt yoksa işletim sistemi tercihine bırakılır
 * (planning/06 §6.3 - üç durumlu tema).
 *
 * localStorage bir gizli bilgi tutmaz ve erişilemezse (özel pencere, kapalı
 * site verisi) sessizce atlanır - try/catch zorunlu.
 */
export function ThemeInit() {
  const script = `
    try {
      var t = localStorage.getItem('qa-theme');
      if (t === 'dark' || t === 'light') {
        document.documentElement.setAttribute('data-theme', t);
      }
    } catch (e) {}
  `;
  // Sabit, kullanıcı girdisi içermeyen tema betiği (XSS riski yok).
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
