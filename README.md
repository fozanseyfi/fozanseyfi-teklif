# Solar Teklif Platformu

Güneş enerjisi (GES) projeleri için keşif, maliyet analizi, fiyatlandırma ve müşteri/yatırımcıya teklif paylaşımını tek bir uygulamada toplayan EPC yönetim platformu.

> Furkan Ozan SEYFİ tarafından, sahada yaşanan EPC tedarik ve fiyatlandırma ihtiyaçlarından doğmuş bireysel bir inisiyatiftir. Sektör paydaşlarıyla iyi niyetle paylaşılır.

## Özellikler

- **Şablon kütüphanesi** — 10 kWp'den 100 MWp'e kadar 9 hazır boyut şablonu; tek tıkla klonla.
- **Keşif-A / Keşif-B** — Doğrudan + dolaylı maliyet kalemleri (~150 hazır kalem, 18 grup).
- **Cash Flow Timeline** — Aylık tahsilat ve ödeme planı, kredi faizi otomatik finans maliyeti.
- **Analiz dashboard** — KPI'lar, marj sliderları, kritik malzeme karşılaştırma, maliyet halkası.
- **BoQ / Priced BoQ** — Müşteriye gönderilecek fiyatsız + fiyatlı çıktılar; kar marjı kalem-bazlı.
- **DoR** — Tedarik / Montaj / Devreye Alma sorumluluk paylaşım tablosu.
- **PDF + Excel** — Marka logosu, watermark, doc-id fingerprint ile müşteriye hazır çıktı.
- **Paylaşım linkleri** — Tokenlı public link, tab seçimli paylaşım, geçerlilik süresi, e-posta gönderim, görüntülenme takibi, müşteri onay/revizyon/soru yanıtları.
- **Pipeline + Aktivite Akışı** — Satış süreci (SENT → UNDER_REVIEW → REVISED → WON/LOST), iç notlar, müşteri etkileşim timeline.
- **Çoklu kullanıcı + rol** — Yönetici / Kullanıcı / Görüntüleyici; kişi-bazlı kaynak erişimi.
- **Marka & Profil** — Logo, renk, slogan, tanıtım PDF, referans PDF, ek belgeler.
- **Audit log** — Tüm save / yetki / paylaşım aksiyonları organizasyon-scope'lu loglanır.

## Mimari

- **Frontend / SSR**: Next.js 16 App Router, React 19, Tailwind CSS 4
- **DB**: PostgreSQL (Supabase) + Prisma ORM (`public` + `solar` şemaları)
- **Auth**: Supabase Auth (E-posta + şifre)
- **Storage**: Supabase Storage (logo + PDF belgeler)
- **Mail**: Gmail SMTP (Nodemailer) — paylaşım linki + müşteri yanıt bildirimi
- **Rate limit**: Upstash Ratelimit (env-conditional)
- **Error monitoring**: Sentry (env-conditional)
- **Deployment**: Vercel
- **PDF generation**: Client-side `window.open + window.print` + Puppeteer (server-side teklif PDF'i)

### Klasör yapısı

```
app/
  (auth)/                       — login, register, password reset
  (dashboard)/                  — kullanıcı paneli (sidebar + footer)
    dashboard/                  — hero + KPI + son projeler + TR haritası
    projects/                   — proje listesi + detail (kesif, boq, analiz, timeline, dor, pipeline, teklif)
    admin/                      — audit, share-links, users (admin-only)
    firm-settings/              — Profilim (marka, ek belgeler, hesap silme, KVKK)
  share/[token]/                — public müşteri paylaşımı (auth gerektirmez)
  api/                          — PDF generation endpoint'leri
  actions/                      — server actions (auth, ges, share, firm, account, ...)
components/
  ges/                          — keşif/BoQ/P-BoQ/DoR/analiz editorler ve print fonksiyonları
  shared/                       — sidebar, footer, brand-settings, company-profile, account-privacy
  dashboard/                    — KPI kartları, TR haritası
  ui/                           — shadcn primitive'ler (button, input, badge, ...)
lib/
  prisma.ts, supabase/          — DB ve auth clientleri
  ges-engine.ts                 — calc() — kar marjı, satış fiyatı hesabı
  ges-defaults.ts               — default kesif + DoR + settings
  pdf-brand.tsx                 — marka renderlama + watermark
  audit-log.ts                  — logAudit helper
  rate-limit.ts, email.ts       — Upstash + Gmail SMTP wrapper'ları
prisma/schema.prisma            — DB şema (Project, ShareLink, AuditLog, vs.)
tmp/*.sql                       — manuel SQL migration dosyaları (Supabase Editor'da çalıştırılır)
```

## Geliştirme

### Gereksinimler

- Node.js 20+
- npm
- Supabase projesi (auth + Postgres)
- (Opsiyonel) Upstash Redis hesabı (rate limit)
- (Opsiyonel) Sentry hesabı (error monitoring)
- (Opsiyonel) Gmail App Password (paylaşım mailleri)

### Kurulum

```bash
git clone https://github.com/fozanseyfi/fozanseyfi-teklif.git
cd fozanseyfi-teklif
npm install
cp .env.example .env
# .env dosyasını kendi değerlerinle doldur (DATABASE_URL, SUPABASE_*, vs.)
npx prisma generate
npm run dev
```

Local'de açılır: <http://localhost:4000>

### .env değişkenleri (özet)

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase Session pooler (port 5432) connection string |
| `DATABASE_URL_TRANSACTION_POOLER` | ✅ | Vercel için pgbouncer pooler (port 6543) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only, never expose to client |
| `NEXT_PUBLIC_APP_URL` | ✅ | Production URL (paylaşım linki için kullanılır) |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | — | `.example.com` (subdomain SSO için) |
| `GMAIL_USER` | — | Paylaşım mailleri için (örn. `fozanseyfi@gmail.com`) |
| `GMAIL_APP_PASSWORD` | — | Gmail App Password (16 hane) |
| `EMAIL_FROM` | — | Mail görünür adı (örn. `"Solar Teklif <fozanseyfi@gmail.com>"`) |
| `UPSTASH_REDIS_REST_URL` | — | Rate limit aktif olur (yoksa no-op) |
| `UPSTASH_REDIS_REST_TOKEN` | — | Upstash REST API token |
| `NEXT_PUBLIC_SENTRY_DSN` | — | Sentry error monitoring (yoksa no-op) |

`.env.example` referans için repo'da hazır.

### Komutlar

```bash
npm run dev          # Geliştirme sunucusu (port 4000)
npm run build        # Production build
npm start            # Production sunucu
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests (calc engine vb.)
npm run test:watch   # Vitest watch modu
```

### CI

Her push ve PR'da otomatik koşar (`.github/workflows/ci.yml`):

1. `npm ci` — bağımlılıkları kur
2. `npx prisma generate` — Prisma client
3. `npm run typecheck` — TypeScript
4. `npm run lint` — ESLint
5. `npm test` — Vitest
6. `npm run build` — Next.js build

Herhangi biri kırılırsa PR merge edilemez (main'de branch protection rule önerilir).

### Manuel SQL migration'lar

Vercel'de `prisma migrate deploy` çalıştırılmıyor (build script: `prisma generate && next build`). DB şeması değiştiğinde, ilgili SQL `tmp/*.sql` dosyasında olur ve **Supabase SQL Editor'da elle çalıştırılır**. Hepsi idempotent (tekrar çalıştırılabilir, hata vermez).

Mevcut migration'lar:

- `tmp/audit-log-migration.sql` — AuditLog tablosu
- `tmp/share-links-migration.sql` — ShareLink tablosu
- `tmp/share-links-email-migration.sql` — recipient_email kolonu
- `tmp/pipeline-activity-migration.sql` — Pipeline alanları + ProjectActivity
- `tmp/rls-policies-migration.sql` — RLS politikaları (Project, ShareLink, vs.)
- `tmp/rls-policies-extra-migration.sql` — RLS politikaları (yardımcı tablolar)

## Deployment (Vercel)

1. Vercel'de repo bağla
2. Environment Variables → yukarıdaki tüm değişkenleri ekle (Production + Preview + Development)
3. Build command: `npm run build` (default)
4. Output: Next.js
5. Deploy

İlk deploy sonrası Supabase Editor'da `tmp/*.sql` migration'larını sırayla çalıştır (idempotent — sorun yok).

## Güvenlik

- **Auth + DB izolasyon**: `requireAuth()` + `organizationId` scope her server action'da
- **RLS politikaları**: Supabase'de defansif derinlik (10+ tabloda)
- **Rate limiting**: Login, paylaşım yanıtı, mail gönderim, davet — Upstash sliding window
- **Security headers**: HSTS, CSP, X-Frame-Options, Referrer-Policy (`next.config.ts`)
- **PDF watermark + doc-id**: müşteriye giden her PDF benzersiz fingerprint
- **Token entropy**: paylaşım token 24-byte base64url (~192-bit)
- **Audit log**: tüm yetki / save / paylaşım aksiyonları izlenir
- **KVKK / GDPR**: hesap silme + kendi veri export (JSON)

Güvenlik açığı bildirimi için: [SECURITY.md](./SECURITY.md)

## Lisans

[LICENSE](./LICENSE) — Proprietary. Açık kaynak değildir. Sektör paydaşları için iyi niyetle yayımlanmıştır; kopyalanması / yeniden paketlenmesi izinsizdir.

## İletişim

- **Furkan Ozan SEYFİ** (Elektrik Mühendisi)
- LinkedIn: [linkedin.com/in/furkan-ozan-seyfi](https://linkedin.com/in/furkan-ozan-seyfi)
- Mail: fozanseyfi@gmail.com
- Web: [fozanseyfi.com](https://fozanseyfi.com)
