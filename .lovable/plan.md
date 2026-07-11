# KuaförApp — Genel Review & Yeni Özellik Yol Haritası

Uygulamayı baştan sona inceledim. Ürün olarak oldukça olgun: randevu akışı, PayTR ödeme, puan/üyelik, push bildirim, güvenlik bloklama, SEO ve Capacitor mobil desteği hazır. Aşağıda **önce hızlı düzeltmeler**, sonra **yeni özellikler** var. Onay verirsen bu sırayla uygularım — istediklerini seçebilir ya da sıralamayı değiştirebilirsin.

---

## Bölüm A — Kritik Düzeltmeler (Önce Yapılmalı)

### A1. Randevu iptal kuralı veritabanına taşınacak

Şu an "24 saat kala iptal edilemez" kuralı sadece arayüzde (`randevularim.tsx:213`). Kötü niyetli bir kullanıcı API'yi doğrudan çağırarak her zaman iptal edebilir.
→ Supabase RLS policy + trigger ile server tarafında zorunlu kılınacak.

### A2. Yorumlarda kullanıcı adı ve tarih gösterilecek

`kuafor.$id.tsx` yorumlarda sadece yıldız + metin gösteriyor. Kim yazmış, ne zaman yazmış belli değil — güven eksikliği yaratıyor.

### A3. Çoklu hizmetli randevu tutarsızlığı

`service_ids` (dizi) kullanıldığı hâlde müşteri listesi hâlâ eski `service_id` (tekil) alanına bakıyor. Çoklu hizmet randevuları eksik görünüyor.

### A4. Çalışan çakışma koruması

Aynı çalışana aynı saate iki randevu alınabiliyor. DB'de unique constraint / trigger eklenecek.

---

## Bölüm B — Yeni Özellikler (Öncelik Sırasına Göre)

### B1. Randevu hatırlatma bildirimi (yüksek etki, düşük maliyet)

Randevudan 24 saat ve 2 saat önce otomatik push. `notifications` tablosu + `pg_cron` + mevcut push altyapısı ile.
→ **No-show oranını doğrudan düşürür.**

### B2. Salon onayında müşteriye bildirim

Esnaf randevuyu onaylayınca / iptal edince müşteriye anlık push. Şu an sessiz.

### B3. "Müsait randevu var" bildirimi (bekleme listesi)

Dolu bir randevu saatlerini kullanıcı "İzle" diyebilir; iptal olunca push gelir. Randevu iptallerinden gelir kurtarır.

### B4. Esnaf paneline haftalık takvim görünümü

`salon-yonetimi.tsx` "Rezervasyon Planı" tabı şu an düz liste. Haftalık grid (saat × gün) eklenecek — esnaf günlük işleyişi tek bakışta görebilir.

### B5. Stil geçmişi & "aynısını tekrar al"

Her tamamlanan randevuya salon notu/fotoğrafı ekleyebilir. Müşteri sonraki randevusunda "geçen seferki gibi" seçer. Sadakat artırır.

### B6. Tekrarlayan randevu ("her Pazartesi 10:00")

Sadık müşteriler için tek dokunuşta aylık plan.

### B7. Geofence: favori salonun yakınındayken hatırlatma

Capacitor Geolocation + push. Kullanıcı favori salonun 500 m'sine girince "randevu almak ister misin?" bildirimi.

---

## Bölüm C — Teknik Borç Temizliği (Arka Planda)

- `useCurrentUser()` hook'u: 25+ dosyadaki tekrarlayan `supabase.auth.getUser()` çağrılarını tek yere topla.
- `admin.tsx` (2109 satır) → 15 sekmeyi ayrı lazy-load dosyalara böl.
- `select("*")` → sadece gerekli kolonlar (12 sorgu).
- Ana sayfadaki tüm yorumları çekip client'ta ortalama alma → DB view'a taşı.
- `xlsx` kütüphanesini dynamic import (bundle'dan ~900KB düşer).
- PayTR polling (3sn) → Supabase Realtime subscription.

---

## Nasıl Devam Edelim?

Bu bir yol haritası; hepsi tek seferde yapılmıyor. Bana şunlardan birini söyle:

1. **"A bölümünün tamamını yap"** — kritik düzeltmelerle başlarım.
2. **"B1, B2, B3'ü yap"** — istediğin özellik numaralarını söyle, o sırayla eklerim.
3. **"Şu özellikten başla"** — herhangi birine odaklan diyebilirsin.
4. **"Farklı bir öncelik istiyorum"** — sıralamayı değiştirebiliriz.

Bu plan sadece bir öneri — sen onayladığında yalnızca seçtiğin maddeleri uygularım.