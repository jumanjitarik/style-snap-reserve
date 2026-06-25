# Online Berber Rezervasyon Sistemi

Türkçe, mobil öncelikli (390px) bir berber randevu uygulaması ve yönetici paneli kuracağım.

## Tasarım Yönü
Premium, erkeksi, "barbershop" estetiği — koyu zemin (kömür/siyah), sıcak amber-bakır vurgu rengi, krem metin. Display font: **Bebas Neue** (başlıklar/logo), gövde: **Inter**. Floating alt tab bar, ortada yükseltilmiş amber "+" FAB butonu. Kart-ağırlıklı, fotoğraf öne çıkan layout.

## Sayfalar (Routes)

**Public**
- `/` — Ana Sayfa: hoşgeldin, arama, kategori chip'leri, yakındaki/öne çıkan berberler
- `/kuaforler` — Tüm berberler listesi + arama/filtre
- `/kuafor/$id` — Berber detayı: foto galerisi, harita (Leaflet), hizmetler+fiyatlar, çalışanlar, "Randevu Al" CTA
- `/auth` — Giriş / Kayıt (e-posta+şifre + Google)

**Authenticated** (`_authenticated/`)
- `/randevu-al` — Berber → Çalışan → Hizmet → Tarih/Saat → Onay akışı (FAB'tan açılır)
- `/randevularim` — Yaklaşan + geçmiş randevular, iptal
- `/favoriler` — Favori berberler
- `/admin` — Admin paneli (yalnız admin rolü)
  - Berber dükkanları CRUD (ad, adres, telefon, lat/lng konum, foto)
  - Hizmetler CRUD (dükkana bağlı, ad, süre, fiyat)
  - Çalışanlar CRUD (dükkana bağlı, isim, foto)
  - Randevuları görme

## Alt Sabit Navigasyon (5 sekme)
1. 🏠 Ana Sayfa → `/`
2. ✂️ Kuaförler → `/kuaforler`
3. ➕ Randevu Al (yükseltilmiş FAB) → `/randevu-al`
4. 📅 Randevular → `/randevularim`
5. ❤️ Favoriler → `/favoriler`

Auth gerektiren sekmelere giriş yapmadan tıklanırsa `/auth` sayfasına yönlendirilir.

## Backend (Lovable Cloud)

**Auth**: E-posta/şifre + Google OAuth (broker üzerinden).

**Roller**: `app_role` enum (`admin`, `user`) + `user_roles` tablosu + `has_role()` security definer fonksiyonu. Çoklu admin atanabilir.

**Tablolar** (RLS açık, public SELECT politikalarıyla berber bilgileri herkese görünür):
- `profiles` — id, full_name, phone, avatar_url
- `user_roles` — user_id, role
- `barbershops` — id, name, address, phone, lat, lng, cover_image_url, description
- `barbershop_images` — shop_id, url, sort_order
- `services` — id, shop_id, name, duration_min, price
- `staff` — id, shop_id, name, photo_url, title
- `appointments` — id, user_id, shop_id, staff_id, service_id, starts_at, status, notes
- `favorites` — user_id, shop_id

**Storage**: `barbershop-photos` (public) bucket — dükkan ve çalışan fotoğrafları.

**RLS özeti**:
- `barbershops`, `barbershop_images`, `services`, `staff` → `SELECT` to `anon, authenticated` (herkese açık görüntüleme); `INSERT/UPDATE/DELETE` sadece admin.
- `appointments`, `favorites` → kullanıcı yalnız kendi verisi; admin tümünü görür.
- `profiles` → kullanıcı yalnız kendisi.

**Harita**: Leaflet + OpenStreetMap (ücretsiz, API key yok). Admin panelinde lat/lng inputları + tıklayarak seçim mini-haritası.

## Teknik Detaylar
- TanStack Start dosya tabanlı routing, `_authenticated/` ile korumalı route'lar.
- Sunucu yan: `createServerFn` + `requireSupabaseAuth` (randevu oluştur, iptal, favori toggle, admin CRUD).
- Public okumalar: server publishable client veya doğrudan tarayıcı supabase client'ı (anon SELECT politikalarıyla).
- Form validasyonu: zod.
- Tarih/saat seçimi: `date-fns` + shadcn Calendar; çalışan/hizmet bazlı dolu slotlar filtrelenir.

## Uygulama Sırası
1. Lovable Cloud'u etkinleştir, Google OAuth'u yapılandır.
2. Veritabanı şeması + RLS + roller + storage bucket.
3. Tasarım sistemi (`src/styles.css` token'ları, fontlar).
4. Layout: alt tab bar, root route.
5. Public sayfalar: Ana sayfa, Kuaförler, Kuaför detayı.
6. Auth sayfası.
7. Korumalı sayfalar: Randevu al akışı, Randevularım, Favoriler.
8. Admin paneli.
9. Seed: birkaç örnek berber verisi (migration ile).
