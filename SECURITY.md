# Güvenlik Politikası

## Bir güvenlik açığı bildirmek için

Lütfen bulduğunuz güvenlik açığını **public GitHub Issue olarak açmayın**. Bunun yerine doğrudan iletişim kurun:

- **E-posta**: fozanseyfi@gmail.com
- **Konu satırı**: `[SECURITY] <kısa özet>`

E-postanızda mümkünse şunları belirtin:

1. Açığın tipi (örn. XSS, CSRF, SQL injection, yetki yükseltme, vb.)
2. Etkilenen bileşen veya endpoint (örn. `/share/[token]`, `/api/pdf/generate`)
3. Reproducer adımları
4. Olası etki ve risk seviyesi tahmini
5. (Varsa) önerilen düzeltme

24 saat içinde bildiriminizin alındığını teyit ederim. Düzeltme süresi açığın ciddiyetine göre değişir:

- **Kritik** (RCE, veri sızıntısı, auth bypass): 7 gün hedef
- **Yüksek** (yetki sınırı ihlali, hassas veri sızıntısı): 30 gün hedef
- **Orta** (XSS, CSRF, açık redirect): 90 gün hedef
- **Düşük** (information disclosure, edge case): en geç bir sonraki release

Sorumlu bildirim için **teşekkür ederim**. Düzeltme yayınlandıktan sonra (siz onaylarsanız) katkıyı release notlarında belirtmekten mutluluk duyarım.

## Desteklenen sürümler

Bu proje şu an aktif geliştirme aşamasında. Sadece **main** branch'i ve son production deploy desteklenir; eski commit'lere geriye dönük güvenlik yamaları sağlanmaz.

## Güvenlik mimarisi (kısa özet)

Detay için README → "Güvenlik" bölümüne bakın.

- Uygulama katmanı: `requireAuth()` + `organizationId` scope
- DB katmanı: Supabase RLS politikaları (10+ tabloda)
- Network: HSTS, CSP, X-Frame-Options
- Brute force koruması: Upstash sliding window rate limit
- Audit log: tüm sensitive aksiyonlar izlenir
- Token entropy: paylaşım token ~192-bit

## Kapsam dışı

Aşağıdaki konular bu repo'nun güvenlik kapsamı dışındadır:

- **Bağımlılıkların third-party açıkları**: Vercel/Supabase/Next.js'in kendi açıkları onların kendi süreçleriyle çözülür. Yine de bilgi için iletişime geçebilirsiniz.
- **Self-hosted deployment'lar**: Bu repo Vercel + Supabase referans altyapısında çalışacak şekilde tasarlandı. Farklı altyapıda çalıştırırsanız kendi güvenliğinizden sorumlusunuz.
- **Brute force denemeleri**: Aktif rate limit varsa raporlamaya gerek yok; yoksa raporlanabilir.

## Sorumlu açıklama

Açığın düzeltilmesinden sonra (en geç 90 gün içinde) detayları herkese açıklayabilirsiniz; öncesinde lütfen koordine edelim.
