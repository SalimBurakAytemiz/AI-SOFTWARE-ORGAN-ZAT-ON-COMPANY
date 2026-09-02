# Kod Standartları — AI Software Company

> **Statü:** kalıcı repository kuralı. Bu depoda ve
> `projects/<slug>/` altındaki tüm projelerde bundan sonra yazılacak kaynak
> kodlar için geçerlidir. İlk uygulama alanı: `projects/qa-portfolio/`.
>
> Bu doküman [`../CLAUDE.md`](../CLAUDE.md) §15 tarafından referans verilir.

Bu dosya, bu depodaki kaynak kodun **nasıl açıklanacağını** tanımlar. Şu an
tek bir standart içerir (Türkçe Kod Açıklama Standardı); ileride başka kod
standartları eklenirse bu dosyaya bölüm olarak eklenir.

---

## 1. Türkçe Kod Açıklama Standardı

### 1.1 Amaç

Human Founder İngilizce bilmiyor. Kaynak kodun **çalışma mantığını, iş
kurallarını ve neden var olduğunu** Türkçe okuyarak anlayabilmesi gerekir.

Amaç kodu Türkçeye çevirmek **değildir**. Amaç, kodun *niçin* böyle yazıldığını
ve *hangi iş kuralını* uyguladığını Türkçe açıklamaktır.

### 1.2 Temel ilke

| Öğe | Dil | Neden |
|---|---|---|
| Değişken, fonksiyon, class, interface/type, component adları | **İngilizce** | Uluslararası yazılım standardı; kütüphane/framework uyumu |
| Dosya ve klasör adları | **İngilizce** | Aynı |
| API isimleri, endpoint yolları | **İngilizce** | Aynı |
| Database tablo ve kolon isimleri | **İngilizce** | Aynı |
| Framework terminolojisi (`useEffect`, `middleware`, `RLS` vb.) | **İngilizce** | Aynı |
| **Kod yorumları / açıklamalar** | **Türkçe** | Founder'ın iş mantığını anlaması için |
| JSDoc / TSDoc blok açıklamaları | **Türkçe** | Aynı |
| Commit mesajları, PR açıklamaları | Türkçe + gerekirse İngilizce teknik terim | Founder + CI okunabilirliği |
| Kullanıcıya dönük metin (UI) | Zaten `tr` / `en` — `next-intl` katalogları | Ürün gereksinimi |

İngilizce bir teknik tanımlayıcı yorumda geçiyorsa, yorumun kalanı onun ne
anlama geldiğini Türkçe anlatmalıdır.

### 1.3 Türkçe açıklamanın **zorunlu** olduğu alanlar

Aşağıdaki 20 alanda anlamlı Türkçe açıklama zorunludur:

1. Önemli dosyaların amacı (dosyanın en üstünde kısa bir blok açıklama)
2. Karmaşık veya kritik fonksiyonlar
3. Business logic (iş mantığı)
4. Authentication (kimlik doğrulama)
5. Authorization (yetkilendirme)
6. Supabase işlemleri
7. Database işlemleri
8. Row Level Security (RLS) politikaları ve `is_admin()` gibi yardımcılar
9. Admin Panel mantığı
10. Project CMS (proje içerik yönetimi)
11. Draft / Published / Archived kuralları
12. Featured / Supported Project kuralları
13. TR / EN localization (dil / çeviri mantığı, fallback)
14. API işlemleri (route handler'lar, server action'lar)
15. Form validation (`zod` şemaları, sunucu tarafı doğrulama)
16. Cache / revalidation (`revalidateTag`, ISR stratejisi)
17. Hata yönetimi (error boundary, try/catch, sınıflandırılmış hatalar)
18. Güvenlik açısından kritik kod (rate limiting, sanitization, CSP, secret kullanımı)
19. Karmaşık React hook'ları
20. Önemli state yönetimi

### 1.4 Yorum formatları (dosya tipine göre)

**TypeScript / JavaScript / React**

```ts
// Türkçe tek satır açıklama.

/**
 * Türkçe teknik açıklama (blok).
 * Birden fazla cümle gerektiğinde veya bir fonksiyon/dosya
 * başlığında kullanılır.
 */
```

Örnek — fonksiyon başlığı (WHY + iş kuralı):

```ts
/**
 * Yalnızca yayınlanmış (status = 'published') ve görünür (visible = true)
 * projeleri döndürür. Taslak, gizlenmiş veya arşivlenmiş projelerin
 * public sitede görünmesini engeller — yayın durumu veritabanında RLS ile
 * de zorlanır, bu fonksiyon o kuralın uygulama tarafındaki karşılığıdır.
 */
async function getPublishedProjects(locale: Locale) {
  // ...
}
```

Örnek — tek satır (WHY):

```ts
// Kullanıcının admin allow-list'inde olup olmadığını doğrular.
// Oturum açmış olmak yeterli değildir; yetki admin_users tablosundan gelir.
const admin = await isAdmin(user.id);
```

**SQL / migration dosyaları**

```sql
-- Türkçe açıklama.

-- projects tablosundaki public okuma politikası:
-- anonim kullanıcı yalnızca yayınlanmış ve görünür satırları görebilir;
-- admin ise is_admin() sayesinde tüm satırları görür.
create policy projects_public_read on projects
for select to anon, authenticated
using (status = 'published' and visible = true or public.is_admin());
```

**CSS**

```css
/* Türkçe açıklama. */

/* Koyu tema, sitenin varsayılan ve tek temasıdır (V1). */
```

**HTML / JSX yorumu**

```html
<!-- Türkçe açıklama. -->
```

```jsx
{/* Türkçe açıklama (JSX içinde). */}
```

### 1.5 En önemli kural — WHY, WHAT değil

**Her satıra yorum ekleme.** Anlamsız, kodu tekrar eden yorumlar yasaktır.

Yanlış:

```ts
const count = 0; // count değişkenini 0 yapar
i++;             // i'yi bir artırır
```

Doğru — yorum şu sorulardan en az birini yanıtlamalıdır:

- Bu kod **neden** var?
- Hangi **iş kuralını** uygular?
- Sistemi **neye karşı** korur?
- **Hangi durumda** çalışır?
- Sistem üzerindeki **etkisi** nedir?

```ts
// Yayınlama işlemi tek bir transaction içinde yapılır: projeyi ve tüm
// çevirilerini/alt kayıtlarını ya hep birlikte yayınlarız ya da hiç.
// Yarım yayınlanmış bir proje public sitede bozuk görünürdü.
await publishProjectTransaction(projectId);
```

### 1.6 Dosya tipi kısıtları

Bir dosya tipi `//`, `--`, `/* */` veya `<!-- -->` yorumunu **desteklemiyorsa**,
o dosyaya geçersiz yorum ekleme (dosyayı bozar).

- **JSON** (`package.json`, `tsconfig.json`, `*.json` veri dosyaları): yorum yok.
  Açıklama gerekirse ilgili `README.md` veya Markdown dokümanında Türkçe tut.
- **`.env` / `.env.example`**: `#` yorumu desteklenir; her değişkenin ne işe
  yaradığını Türkçe tek satırda açıkla, **değeri asla yazma**.
- **YAML** (`*.yml`): `#` yorumu desteklenir; kullan.
- **Markdown**: zaten Türkçe yazılır.

### 1.7 Kod kalitesi kuralları

Türkçe açıklamalar:

- syntax hatası oluşturmamalı,
- lint kurallarını bozmamalı (satır uzunluğu, format),
- build'i bozmamalı,
- kodu gereksiz kalabalıklaştırmamalı (WHY kuralı, §1.5),
- **secret, token, şifre, gerçek kişisel veri veya güvenlik açığı ipucu
  içermemeli**,
- Türkçe karakter kodlaması UTF-8 olmalı (tüm dosyalar UTF-8).

### 1.8 Kapsam ve geçerlilik

- Bu standart, bu depoda ve `projects/<slug>/` altındaki projelerde **bundan
  sonra** yazılacak kaynak kodlar için geçerlidir.
- Mevcut `runtime/` (TypeScript) kod tabanı **geriye dönük olarak
  değiştirilmez**; yalnızca oraya *yeni* eklenen dosyalar bu standarda uyar.
- İlk tam uygulama alanı: `projects/qa-portfolio/` (build yetkisi verildi,
  kod henüz yazılmadı).

---

## 2. Kullanıcıya (Human Founder) dönük raporlama standardı

Bundan sonraki tüm geliştirme raporları, hata açıklamaları, karar soruları,
ilerleme raporları, test sonuçları ve sonraki adımlar **Türkçe** yazılır.
(Bkz. [`../CLAUDE.md`](../CLAUDE.md) §15.)

### 2.1 Her önemli geliştirme aşamasının sonunda Türkçe rapor

Sıralı 7 başlık:

1. **Hangi dosyalar oluşturuldu veya değiştirildi?** (yol listesi)
2. **Hangi özellik geliştirildi?**
3. **Geliştirilen bölüm ne işe yarıyor?** (iş değeri, Türkçe)
4. **Hangi testler çalıştırıldı?** (komut adları — İngilizce — + Türkçe açıklama)
5. **Test sonucu nedir?** (geçti/kaldı, sayılar; İngilizce çıktı gösterildiyse
   Türkçe özeti)
6. **Herhangi bir hata veya risk var mı?**
7. **Sonraki aşama nedir?**

### 2.2 Karar gerektiğinde

1. Durumu Türkçe açıkla.
2. Seçenekleri Türkçe açıkla.
3. Her seçeneğin sonucunu Türkçe açıkla.
4. Hangi seçeneği önerdiğini **açıkça** belirt.

### 2.3 Bir komut başarısız olduğunda / hata oluştuğunda

1. Hatayı Türkçe açıkla.
2. Kritik olup olmadığını belirt.
3. Biliniyorsa nedenini açıkla.
4. Sırada ne yapılacağını açıkla.

İngilizce terminal çıktısı gösterildiğinde, Founder'ın onu kendi başına
yorumlaması beklenmez — çıktının ne dediği Türkçe özetlenir.

---

## 3. Governance notları

- Bu doküman kaynak kodun **açıklanmasını** düzenler; hiçbir kalite kapısını,
  güvenlik kuralını, Human Founder onay gereksinimini veya
  `CLAUDE.md` §13 yasaklarını **zayıflatmaz**.
- `main` dalına birleştirme, üretime dağıtım, ücretli sağlayıcı ekleme ve
  `feature-development` sürecini başlatma kararları değişmeden Human Founder'a
  aittir.
