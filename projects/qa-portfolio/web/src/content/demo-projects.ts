import type { DbLocale } from "@/lib/db/database.types";
import type { ProjectCaseStudy } from "@/lib/domain/project";

/**
 * ====================================================================
 *  DEMO / SANITIZED İÇERİK - GERÇEK PROFESYONEL VERİ DEĞİLDİR.
 * ====================================================================
 *
 * Bu dosyadaki her proje uydurma bir örnektir. Amaç: vaka çalışması şablonunu,
 * QA bileşenlerini ve sanitization hattını gerçekçi hacimde içerikle test
 * etmek. Şirket adları, metrikler, bug'lar ve senaryolar TAMAMEN KURGUSALDIR.
 *
 * KURAL (ADR-0008, planning/12 RISK-052): ekip gerçek profesyonel bilgi
 * uydurmaz. Bu içerik "demo: true" ile işaretlidir ve sitede görünür bir
 * "DEMO / SANITIZED" bandıyla sunulur. Gerçek portföy içeriği faz 3+'te admin
 * panelden girilecek (planning/13-content-intake-checklist.md).
 */

type Localized<T> = Record<DbLocale, T>;

interface DemoDef {
  slug: string;
  classification: ProjectCaseStudy["classification"];
  featured: boolean;
  supported: boolean;
  nda: boolean;
  company: Localized<string | null>;
  companyHidden: boolean;
  displayOrder: number;
  period: ProjectCaseStudy["period"];
  links: ProjectCaseStudy["links"];
  industry: Localized<string | null>;
  platforms: string[];
  tools: string[];
  testTypes: Localized<string[]>;
  tr: DemoContent;
  en: DemoContent;
}

interface DemoContent {
  title: string;
  summary: string;
  roleTitle: string;
  taxonomy: string[];
  sections: ProjectCaseStudy["sections"];
  coverage: ProjectCaseStudy["coverage"];
  scenarios: ProjectCaseStudy["scenarios"];
  bugs: ProjectCaseStudy["bugs"];
  apiExamples: ProjectCaseStudy["apiExamples"];
  sqlExamples: ProjectCaseStudy["sqlExamples"];
  seo: ProjectCaseStudy["seo"];
}

const DEMO_DEFS: DemoDef[] = [
  {
    slug: "demo-checkout-regression-suite",
    classification: "professional",
    featured: true,
    supported: false,
    nda: false,
    company: { tr: "DEMO Şirketi A.Ş.", en: "DEMO Company Inc." },
    companyHidden: false,
    displayOrder: 1,
    period: { start: "2024-02", end: "2024-09", ongoing: false },
    links: { github: null, external: null },
    industry: { tr: "E-ticaret (DEMO)", en: "E-commerce (DEMO)" },
    platforms: ["Web", "API"],
    tools: ["Playwright", "Postman", "GitHub Actions", "PostgreSQL"],
    testTypes: {
      tr: ["Otomasyon", "Regresyon", "API", "Veritabanı doğrulama"],
      en: ["Automation", "Regression", "API", "Database validation"],
    },
    tr: {
      title: "DEMO — Ödeme (checkout) regresyon paketi",
      summary:
        "SANITIZED örnek: bir e-ticaret ödeme akışı için uçtan uca otomasyon paketi; regresyon süresini kurgusal olarak %62 azalttı.",
      roleTitle: "Kıdemli QA Mühendisi (DEMO)",
      taxonomy: ["Web", "API", "Playwright", "Otomasyon"],
      sections: {
        overviewMd:
          "> **DEMO / SANITIZED** — Aşağıdaki içerik kurgusaldır, gerçek bir müşteriyi temsil etmez.\n\n" +
          "Kurgusal bir e-ticaret platformunun **ödeme (checkout)** akışı, her sürümde elle test ediliyordu ve ortalama **2 gün** sürüyordu. Amaç: kritik ödeme yollarını otomatikleştirip regresyonu bir CI adımına indirmek.",
        testingScopeMd:
          "**Kapsam içi:** sepet → adres → kargo → ödeme → sipariş onayı; misafir ve üye akışları; 3 para birimi; kupon ve hediye kartı.\n\n" +
          "**Kapsam dışı:** ödeme sağlayıcısının kendi altyapısı (sandbox mock'landı), pazar yeri satıcı paneli, mobil uygulama.",
        testStrategyMd:
          "- **Seviyeler:** API sözleşme testleri (hızlı geri bildirim) + tarayıcı E2E (kritik yollar).\n" +
          "- **Veri:** her koşu kendi namespace'inde kurgusal sipariş verisi üretir ve sonda temizler.\n" +
          "- **Ortam:** izole staging; ödeme sağlayıcısı sandbox + deterministik mock.\n" +
          "- **CI:** PR'da API + smoke E2E; gecelik tam regresyon; 3 tarayıcı.",
        testCoverageMd: null,
        challengesMd:
          "En zor kısım **kur ve vergi hesaplamasının** ondalık yuvarlama farklarıydı: farklı para birimlerinde beklenen tutar, servisin döndürdüğünden 1 kuruş sapıyordu. Çözüm: beklenen değeri servisin yuvarlama kuralıyla hesaplayan bir yardımcı ve sınır değer testleri (0, negatif indirim, çok büyük sepet).",
        impactMd:
          "- Regresyon süresi kurgusal olarak **2 gün → ~3 saat**.\n" +
          "- Sürüm öncesi yakalanan **3 sürüm-engelleyici** ödeme hatası (bkz. Bug örnekleri).\n" +
          "- Ödeme akışı otomasyon kapsamı **%0 → %85**.",
        lessonsMd:
          "Para/kur içeren testlerde \"yaklaşık eşitlik\" yerine servisin **kendi hesaplama kuralını** test kodunda yeniden üretmek gerekiyor; aksi halde testler ya kırılgan ya da gerçek hatayı gizler.",
      },
      coverage: [
        { area: "Sepet ve fiyatlandırma", value: 88 },
        { area: "Ödeme yöntemleri", value: 82 },
        { area: "Kupon / hediye kartı", value: 76 },
        { area: "Sipariş onayı / e-posta", value: 70 },
      ],
      scenarios: [
        {
          code: "TS-01",
          priority: "p0",
          kind: "e2e",
          automated: true,
          title: "Misafir kullanıcı kredi kartıyla siparişi tamamlar",
          preconditionsMd: "Stokta en az 1 ürün var; ödeme sandbox erişilebilir.",
          stepsMd:
            "1. Ürünü sepete ekle\n2. Misafir olarak devam et\n3. Geçerli teslimat adresi gir\n4. Standart kargoyu seç\n5. Test kartı `4242 4242 4242 4242` ile öde",
          expectedMd:
            "Sipariş oluşur, sipariş numarası görünür, onay e-postası kuyruğa alınır, stok 1 azalır.",
          notesMd: "DEMO test kartı — gerçek kart verisi kullanılmaz.",
        },
        {
          code: "TS-02",
          priority: "p1",
          kind: "api",
          automated: true,
          title: "Geçersiz kupon kodu 422 ile reddedilir",
          preconditionsMd: null,
          stepsMd: "`POST /v1/cart/{id}/coupon` gövde `{ \"code\": \"GECERSIZ\" }`",
          expectedMd: "HTTP 422; `error.code = COUPON_INVALID`; sepet toplamı değişmez.",
          notesMd: null,
        },
        {
          code: "TS-03",
          priority: "p1",
          kind: "regression",
          automated: true,
          title: "EUR sepetinde vergi tutarı yuvarlama kuralına uyar",
          preconditionsMd: "Para birimi EUR; vergi oranı %19.",
          stepsMd: "37.83 EUR ara toplamlı sepet oluştur; vergi satırını oku.",
          expectedMd: "Vergi = 7.19 EUR (yukarı yuvarlama), toplam = 45.02 EUR.",
          notesMd: "Bu senaryo BUG-02'yi yakalayan regresyon testidir.",
        },
      ],
      bugs: [
        {
          code: "BUG-01",
          severity: "blocker",
          state: "fixed",
          environment: "staging",
          title: "Çift tıklamada sipariş iki kez oluşuyor",
          summaryMd: "\"Siparişi tamamla\" butonuna hızlı iki kez tıklandığında iki ayrı sipariş ve iki çekim oluşuyordu.",
          stepsMd: "1. Ödeme adımına gel\n2. \"Siparişi tamamla\"ya ~200 ms arayla iki kez tıkla",
          expectedMd: "Tek sipariş; buton ilk tıklamada devre dışı kalır.",
          actualMd: "İki sipariş, iki sandbox çekimi.",
          rootCauseMd: "İstemci butonu devre dışı bırakıyordu ama istek zaten uçmuştu; sunucuda idempotency anahtarı yoktu.",
          resolutionMd: "`Idempotency-Key` başlığı + sunucu tarafı 60 sn tekrar-koruması eklendi; regresyon testi TS-04.",
        },
        {
          code: "BUG-02",
          severity: "critical",
          state: "fixed",
          environment: "staging",
          title: "EUR vergi tutarı 1 kuruş eksik hesaplanıyor",
          summaryMd: "EUR sepetlerde vergi aşağı yuvarlanıyor; fatura toplamı ödeme tutarıyla uyuşmuyordu.",
          stepsMd: "37.83 EUR ara toplamlı sepette vergi satırını kontrol et.",
          expectedMd: "7.19 EUR",
          actualMd: "7.18 EUR",
          rootCauseMd: "Vergi servisi `floor`, fatura servisi `round` kullanıyordu.",
          resolutionMd: "Tek yuvarlama yardımcısı; her iki servis onu çağırıyor. Regresyon: TS-03.",
        },
        {
          code: "BUG-03",
          severity: "major",
          state: "deferred",
          environment: "staging",
          title: "Süresi dolmuş hediye kartı belirsiz hata veriyor",
          summaryMd: "Süresi geçmiş hediye kartı uygulandığında kullanıcıya sadece \"Bir hata oluştu\" gösteriliyor.",
          stepsMd: "Süresi geçmiş DEMO hediye kartı kodunu uygula.",
          expectedMd: "\"Bu hediye kartının süresi dolmuş\" gibi net mesaj.",
          actualMd: "Genel hata; kod alanı temizlenmiyor.",
          rootCauseMd: "API `GIFTCARD_EXPIRED` döndürüyor ama istemci bu kodu haritalamıyor.",
          resolutionMd: "Sonraki sürüme ertelendi (düşük sıklık); istemci mesaj haritası genişletilecek.",
        },
      ],
      apiExamples: [
        {
          code: "API-01",
          method: "POST",
          endpoint: "/v1/orders",
          requestBody:
            '{\n  "cart_id": "DEMO-cart-1001",\n  "payment": { "method": "card", "token": "tok_demo_visa" },\n  "idempotency_key": "DEMO-key-abc123"\n}',
          responseStatus: 201,
          responseBody:
            '{\n  "order_id": "DEMO-ord-55021",\n  "status": "confirmed",\n  "total": { "amount": 4502, "currency": "EUR" }\n}',
          title: "Sipariş oluşturma — idempotency anahtarıyla",
          notesMd: "BUG-01'in çözümünü gösterir: aynı `idempotency_key` ile ikinci istek yeni sipariş oluşturmaz, ilk siparişi döndürür.",
        },
        {
          code: "API-02",
          method: "POST",
          endpoint: "/v1/cart/DEMO-cart-1001/coupon",
          requestBody: '{ "code": "GECERSIZ" }',
          responseStatus: 422,
          responseBody: '{ "error": { "code": "COUPON_INVALID", "message": "Coupon not found or expired" } }',
          title: "Geçersiz kupon reddi",
          notesMd: "Hata gövdesi makine-okunur bir `code` içermeli; istemci bunu yerelleştirilmiş mesaja çevirir.",
        },
      ],
      sqlExamples: [
        {
          code: "SQL-01",
          dialect: "postgres",
          querySql:
            "-- Bir siparişin satır toplamı, sipariş başlığındaki total ile tutuyor mu?\nselect o.order_id,\n       o.total_amount,\n       sum(i.qty * i.unit_price) as line_sum\nfrom demo_orders o\njoin demo_order_items i on i.order_id = o.order_id\nwhere o.order_id = 'DEMO-ord-55021'\ngroup by o.order_id, o.total_amount\nhaving o.total_amount <> sum(i.qty * i.unit_price);",
          sampleResult: "(0 satır)  -- tutarlı: başlık toplamı = satır toplamları",
          title: "Sipariş toplamı — başlık/satır tutarlılığı",
          explanationMd: "Her E2E siparişten sonra çalışır; 0 satır beklenir. BUG-02 bu sorguyla da yakalanabiliyordu.",
        },
      ],
      seo: {
        title: "DEMO — Ödeme regresyon paketi | Vaka çalışması",
        description:
          "SANITIZED örnek vaka çalışması: e-ticaret ödeme akışı için Playwright + API otomasyonu.",
      },
    },
    en: {
      title: "DEMO — Checkout regression suite",
      summary:
        "SANITIZED example: end-to-end automation suite for an e-commerce checkout flow; cut regression time by a fictional 62%.",
      roleTitle: "Senior QA Engineer (DEMO)",
      taxonomy: ["Web", "API", "Playwright", "Automation"],
      sections: {
        overviewMd:
          "> **DEMO / SANITIZED** — the content below is fictional and does not represent a real client.\n\n" +
          "A fictional e-commerce platform's **checkout** flow was tested manually every release, taking about **2 days**. Goal: automate the critical payment paths and reduce regression to a single CI step.",
        testingScopeMd:
          "**In scope:** cart → address → shipping → payment → order confirmation; guest and member flows; 3 currencies; coupons and gift cards.\n\n" +
          "**Out of scope:** the payment provider's own infrastructure (sandbox mocked), the marketplace seller panel, the mobile app.",
        testStrategyMd:
          "- **Levels:** API contract tests (fast feedback) + browser E2E (critical paths).\n" +
          "- **Data:** each run creates fictional order data in its own namespace and cleans up at the end.\n" +
          "- **Environment:** isolated staging; payment provider sandbox + deterministic mock.\n" +
          "- **CI:** API + smoke E2E on PR; nightly full regression; 3 browsers.",
        testCoverageMd: null,
        challengesMd:
          "The hardest part was **currency and tax rounding**: the expected amount differed from the service's response by one cent in some currencies. Fix: a helper that reproduces the service's rounding rule, plus boundary tests (zero, negative discount, very large cart).",
        impactMd:
          "- Regression time went from a fictional **2 days → ~3 hours**.\n" +
          "- **3 release-blocking** payment bugs caught before release (see Bug examples).\n" +
          "- Checkout automation coverage **0% → 85%**.",
        lessonsMd:
          "For money/currency tests, reproduce the service's **own calculation rule** in the test code instead of asserting \"approximately equal\" — otherwise the tests are either flaky or they hide the real bug.",
      },
      coverage: [
        { area: "Cart and pricing", value: 88 },
        { area: "Payment methods", value: 82 },
        { area: "Coupon / gift card", value: 76 },
        { area: "Order confirmation / email", value: 70 },
      ],
      scenarios: [
        {
          code: "TS-01",
          priority: "p0",
          kind: "e2e",
          automated: true,
          title: "Guest user completes an order with a credit card",
          preconditionsMd: "At least 1 product in stock; payment sandbox reachable.",
          stepsMd:
            "1. Add product to cart\n2. Continue as guest\n3. Enter a valid shipping address\n4. Select standard shipping\n5. Pay with test card `4242 4242 4242 4242`",
          expectedMd:
            "Order is created, order number is shown, confirmation email is queued, stock decreases by 1.",
          notesMd: "DEMO test card — no real card data is used.",
        },
        {
          code: "TS-02",
          priority: "p1",
          kind: "api",
          automated: true,
          title: "Invalid coupon code is rejected with 422",
          preconditionsMd: null,
          stepsMd: "`POST /v1/cart/{id}/coupon` with body `{ \"code\": \"INVALID\" }`",
          expectedMd: "HTTP 422; `error.code = COUPON_INVALID`; cart total unchanged.",
          notesMd: null,
        },
        {
          code: "TS-03",
          priority: "p1",
          kind: "regression",
          automated: true,
          title: "EUR cart tax amount follows the rounding rule",
          preconditionsMd: "Currency EUR; tax rate 19%.",
          stepsMd: "Create a cart with 37.83 EUR subtotal; read the tax line.",
          expectedMd: "Tax = 7.19 EUR (round up), total = 45.02 EUR.",
          notesMd: "This scenario is the regression test that catches BUG-02.",
        },
      ],
      bugs: [
        {
          code: "BUG-01",
          severity: "blocker",
          state: "fixed",
          environment: "staging",
          title: "Double click creates the order twice",
          summaryMd: "Clicking \"Place order\" twice quickly created two separate orders and two charges.",
          stepsMd: "1. Reach the payment step\n2. Click \"Place order\" twice ~200 ms apart",
          expectedMd: "One order; the button is disabled on the first click.",
          actualMd: "Two orders, two sandbox charges.",
          rootCauseMd: "The client disabled the button but the request had already been sent; the server had no idempotency key.",
          resolutionMd: "Added an `Idempotency-Key` header + server-side 60s replay protection; regression test TS-04.",
        },
        {
          code: "BUG-02",
          severity: "critical",
          state: "fixed",
          environment: "staging",
          title: "EUR tax amount is one cent short",
          summaryMd: "Tax was rounded down for EUR carts; the invoice total did not match the payment amount.",
          stepsMd: "Check the tax line on a cart with 37.83 EUR subtotal.",
          expectedMd: "7.19 EUR",
          actualMd: "7.18 EUR",
          rootCauseMd: "The tax service used `floor`, the invoice service used `round`.",
          resolutionMd: "A single rounding helper; both services call it. Regression: TS-03.",
        },
        {
          code: "BUG-03",
          severity: "major",
          state: "deferred",
          environment: "staging",
          title: "Expired gift card shows a vague error",
          summaryMd: "Applying an expired gift card only shows \"Something went wrong\" to the user.",
          stepsMd: "Apply an expired DEMO gift card code.",
          expectedMd: "A clear message like \"This gift card has expired\".",
          actualMd: "Generic error; the code field is not cleared.",
          rootCauseMd: "The API returns `GIFTCARD_EXPIRED` but the client does not map that code.",
          resolutionMd: "Deferred to a later release (low frequency); the client message map will be extended.",
        },
      ],
      apiExamples: [
        {
          code: "API-01",
          method: "POST",
          endpoint: "/v1/orders",
          requestBody:
            '{\n  "cart_id": "DEMO-cart-1001",\n  "payment": { "method": "card", "token": "tok_demo_visa" },\n  "idempotency_key": "DEMO-key-abc123"\n}',
          responseStatus: 201,
          responseBody:
            '{\n  "order_id": "DEMO-ord-55021",\n  "status": "confirmed",\n  "total": { "amount": 4502, "currency": "EUR" }\n}',
          title: "Create order — with an idempotency key",
          notesMd: "Demonstrates the BUG-01 fix: a second request with the same `idempotency_key` does not create a new order, it returns the first one.",
        },
        {
          code: "API-02",
          method: "POST",
          endpoint: "/v1/cart/DEMO-cart-1001/coupon",
          requestBody: '{ "code": "INVALID" }',
          responseStatus: 422,
          responseBody: '{ "error": { "code": "COUPON_INVALID", "message": "Coupon not found or expired" } }',
          title: "Invalid coupon rejection",
          notesMd: "The error body must carry a machine-readable `code`; the client turns it into a localized message.",
        },
      ],
      sqlExamples: [
        {
          code: "SQL-01",
          dialect: "postgres",
          querySql:
            "-- Does an order's line total match the total on the order header?\nselect o.order_id,\n       o.total_amount,\n       sum(i.qty * i.unit_price) as line_sum\nfrom demo_orders o\njoin demo_order_items i on i.order_id = o.order_id\nwhere o.order_id = 'DEMO-ord-55021'\ngroup by o.order_id, o.total_amount\nhaving o.total_amount <> sum(i.qty * i.unit_price);",
          sampleResult: "(0 rows)  -- consistent: header total = sum of lines",
          title: "Order total — header/line consistency",
          explanationMd: "Runs after every E2E order; 0 rows expected. BUG-02 was also catchable with this query.",
        },
      ],
      seo: {
        title: "DEMO — Checkout regression suite | Case study",
        description:
          "SANITIZED example case study: Playwright + API automation for an e-commerce checkout flow.",
      },
    },
  },
  {
    slug: "demo-public-api-contract-testing",
    classification: "supported",
    featured: true,
    supported: true,
    nda: true,
    company: { tr: null, en: null },
    companyHidden: true,
    displayOrder: 2,
    period: { start: "2023-05", end: "2023-11", ongoing: false },
    links: { github: null, external: null },
    industry: { tr: "Fintech (DEMO)", en: "Fintech (DEMO)" },
    platforms: ["API"],
    tools: ["Postman", "Newman", "GitHub Actions", "k6"],
    testTypes: { tr: ["API", "Sözleşme", "Performans"], en: ["API", "Contract", "Performance"] },
    tr: {
      title: "DEMO — Public API sözleşme ve yük testi",
      summary:
        "SANITIZED örnek: NDA'lı kurgusal bir fintech için public API sözleşme testleri ve temel yük profili.",
      roleTitle: "QA Danışmanı (DEMO)",
      taxonomy: ["API", "Postman", "k6"],
      sections: {
        overviewMd:
          "> **DEMO / SANITIZED · NDA** — Kurgusal içerik. NDA nedeniyle şirket adı ve bazı ayrıntılar gizli tutulur.\n\n" +
          "Kurgusal bir ödeme API'sinin dış geliştiricilere açılması öncesinde sözleşme (schema) testleri ve temel yük profili oluşturuldu.",
        testingScopeMd:
          "**Kapsam içi:** OpenAPI şema uyumu, hata gövdesi tutarlılığı, kimlik doğrulama, hız sınırı başlıkları.\n\n**Kapsam dışı:** iç servisler, veritabanı, ödeme mutabakatı.",
        testStrategyMd:
          "- Postman koleksiyonu + Newman ile şema doğrulama (her endpoint için 200 + hata yolları).\n- k6 ile 50 sanal kullanıcı, 5 dk sabit yük; p95 < 400 ms hedefi.\n- CI: PR'da sözleşme testleri; yük testi yalnızca staging'de manuel.",
        testCoverageMd: null,
        challengesMd:
          "Hız sınırı (rate limit) başlıkları bazı endpoint'lerde eksikti; sözleşme testi bunu yakaladı ve dokümantasyonla kod arasındaki farkı ortaya çıkardı.",
        impactMd:
          "- 4 endpoint'te tutarsız hata gövdesi düzeltildi.\n- Eksik `Retry-After` başlığı 2 endpoint'e eklendi.\n- Yük testinde p95 = 310 ms (hedef altında).",
        lessonsMd:
          "Sözleşme testleri yalnızca \"mutlu yol\"u değil, hata gövdelerinin **şeklini** de doğrulamalı; istemciler asıl orada kırılıyor.",
      },
      coverage: [
        { area: "Şema uyumu", value: 92 },
        { area: "Hata yolları", value: 80 },
        { area: "Kimlik doğrulama", value: 85 },
      ],
      scenarios: [
        {
          code: "TS-01",
          priority: "p0",
          kind: "api",
          automated: true,
          title: "Tüm 2xx yanıtları OpenAPI şemasına uyar",
          preconditionsMd: "Geçerli API anahtarı (DEMO).",
          stepsMd: "Koleksiyondaki her endpoint için örnek istek gönder; yanıtı şemayla doğrula.",
          expectedMd: "Hiçbir şema ihlali yok.",
          notesMd: null,
        },
        {
          code: "TS-02",
          priority: "p1",
          kind: "api",
          automated: true,
          title: "429 yanıtı Retry-After başlığı içerir",
          preconditionsMd: null,
          stepsMd: "Hız sınırı aşılana kadar hızlı istek gönder.",
          expectedMd: "HTTP 429; `Retry-After` başlığı saniye cinsinden mevcut.",
          notesMd: "BUG-01'i yakalar.",
        },
      ],
      bugs: [
        {
          code: "BUG-01",
          severity: "major",
          state: "fixed",
          environment: "staging",
          title: "429 yanıtında Retry-After başlığı yok",
          summaryMd: "İki endpoint hız sınırında 429 dönüyor ama `Retry-After` başlığı göndermiyordu; istemciler ne kadar bekleyeceğini bilemiyordu.",
          stepsMd: "İlgili endpoint'e sınır aşımına kadar istek gönder.",
          expectedMd: "`Retry-After` başlığı mevcut.",
          actualMd: "Başlık yok.",
          rootCauseMd: "Hız sınırı ara katmanı iki eski route'a uygulanmamıştı.",
          resolutionMd: "Ara katman global hale getirildi; sözleşme testi TS-02 eklendi.",
        },
      ],
      apiExamples: [
        {
          code: "API-01",
          method: "GET",
          endpoint: "/v1/accounts/DEMO-acc-01/balance",
          requestBody: null,
          responseStatus: 200,
          responseBody: '{ "currency": "TRY", "available": 125000, "pending": 0 }',
          title: "Bakiye sorgusu — şema doğrulaması",
          notesMd: "`available` ve `pending` alanları tamsayı (kuruş) olmalı; şema testi bunu doğrular.",
        },
      ],
      sqlExamples: [],
      seo: { title: "DEMO — API sözleşme testi | Vaka çalışması", description: "SANITIZED örnek: fintech public API sözleşme ve yük testi." },
    },
    en: {
      title: "DEMO — Public API contract and load testing",
      summary:
        "SANITIZED example: public API contract tests and a basic load profile for a fictional fintech under NDA.",
      roleTitle: "QA Consultant (DEMO)",
      taxonomy: ["API", "Postman", "k6"],
      sections: {
        overviewMd:
          "> **DEMO / SANITIZED · NDA** — Fictional content. Company name and some details are withheld due to NDA.\n\n" +
          "Before a fictional payment API was opened to external developers, contract (schema) tests and a basic load profile were built.",
        testingScopeMd:
          "**In scope:** OpenAPI schema conformance, error body consistency, authentication, rate-limit headers.\n\n**Out of scope:** internal services, the database, payment reconciliation.",
        testStrategyMd:
          "- Postman collection + Newman for schema validation (200 + error paths for every endpoint).\n- k6 with 50 virtual users, 5 min steady load; p95 < 400 ms target.\n- CI: contract tests on PR; load test manual on staging only.",
        testCoverageMd: null,
        challengesMd:
          "Rate-limit headers were missing on some endpoints; the contract test caught this and revealed the gap between the docs and the code.",
        impactMd:
          "- Inconsistent error bodies fixed on 4 endpoints.\n- Missing `Retry-After` header added to 2 endpoints.\n- Load test p95 = 310 ms (under target).",
        lessonsMd:
          "Contract tests should validate not just the happy path but the **shape** of error bodies — that is where clients actually break.",
      },
      coverage: [
        { area: "Schema conformance", value: 92 },
        { area: "Error paths", value: 80 },
        { area: "Authentication", value: 85 },
      ],
      scenarios: [
        {
          code: "TS-01",
          priority: "p0",
          kind: "api",
          automated: true,
          title: "All 2xx responses conform to the OpenAPI schema",
          preconditionsMd: "A valid API key (DEMO).",
          stepsMd: "Send a sample request for every endpoint in the collection; validate the response against the schema.",
          expectedMd: "No schema violations.",
          notesMd: null,
        },
        {
          code: "TS-02",
          priority: "p1",
          kind: "api",
          automated: true,
          title: "A 429 response includes a Retry-After header",
          preconditionsMd: null,
          stepsMd: "Send requests quickly until the rate limit is exceeded.",
          expectedMd: "HTTP 429; `Retry-After` header present, in seconds.",
          notesMd: "Catches BUG-01.",
        },
      ],
      bugs: [
        {
          code: "BUG-01",
          severity: "major",
          state: "fixed",
          environment: "staging",
          title: "No Retry-After header on 429 responses",
          summaryMd: "Two endpoints returned 429 at the rate limit but did not send a `Retry-After` header; clients could not know how long to wait.",
          stepsMd: "Send requests to the endpoint until the limit is exceeded.",
          expectedMd: "`Retry-After` header present.",
          actualMd: "No header.",
          rootCauseMd: "The rate-limit middleware was not applied to two legacy routes.",
          resolutionMd: "The middleware was made global; contract test TS-02 was added.",
        },
      ],
      apiExamples: [
        {
          code: "API-01",
          method: "GET",
          endpoint: "/v1/accounts/DEMO-acc-01/balance",
          requestBody: null,
          responseStatus: 200,
          responseBody: '{ "currency": "TRY", "available": 125000, "pending": 0 }',
          title: "Balance query — schema validation",
          notesMd: "`available` and `pending` must be integers (minor units); the schema test verifies this.",
        },
      ],
      sqlExamples: [],
      seo: { title: "DEMO — API contract testing | Case study", description: "SANITIZED example: fintech public API contract and load testing." },
    },
  },
];

function toCaseStudy(def: DemoDef, locale: DbLocale): ProjectCaseStudy {
  const c = def[locale];
  return {
    slug: def.slug,
    classification: def.classification,
    featured: def.featured,
    supported: def.supported,
    nda: def.nda,
    company: def.companyHidden ? null : def.company[locale],
    companyHidden: def.companyHidden,
    displayOrder: def.displayOrder,
    title: c.title,
    summary: c.summary,
    roleTitle: c.roleTitle,
    taxonomy: c.taxonomy,
    demo: true,
    period: def.period,
    links: def.links,
    industry: def.industry[locale],
    platforms: def.platforms,
    tools: def.tools,
    testTypes: def.testTypes[locale],
    sections: c.sections,
    coverage: c.coverage,
    scenarios: c.scenarios,
    bugs: c.bugs,
    apiExamples: c.apiExamples,
    sqlExamples: c.sqlExamples,
    seo: c.seo,
  };
}

/** Tüm demo vaka çalışmalarını aktif dile çözülmüş döndürür. */
export function getDemoCaseStudies(locale: DbLocale): ProjectCaseStudy[] {
  return DEMO_DEFS.map((d) => toCaseStudy(d, locale)).sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
}

export const DEMO_SLUGS = DEMO_DEFS.map((d) => d.slug);
