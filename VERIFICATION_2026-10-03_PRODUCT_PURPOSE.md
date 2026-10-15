# Genel ürün eşleştirmesi · 3 Ekim 2026

Bu sürüm yalnız CH340'a özel değildir. Ortak bir bileşen numarası, başka bir ürünün eşleşmesi sayılmaz. Mağazadaki görünen ürün adı esas alınır; URL ve sitemap adları yalnız keşif ipucudur.

- Çıplak entegre, modül, geliştirme kartı, sensör/prob, motor/sürücü, röle/modül, kablo, ekran ve aksesuar türleri ayrılır.
- Ortak CH340/CP2102/FT232 gibi arabirim çipleri farklı ana kart/işlemci modellerini eşitlemez. Açıkça farklı voltaj, akım, paket, kamera, USB soketi ve çalışma özellikleri ayrıca kontrol edilir. Ekran eklenmiş kart temel kartla aynı ürün sayılmaz.
- Daha önce bağlanmış teklifler de yeniden kontrol edilir. Bilinen farklı ürünler en düşük fiyat ve sepet hesabından çıkarılır; link karşılaştırmasında ayrı kapalı açıklama altında tutulur.
- Ürün ve teklif fotoğrafları gerçek mağaza kaydından gösterilir. JPEG/PNG piksellerinden kenar dağılımı, renk dağılımı ve en/boy benzerliği çıkarılır. Aynı/benzer fotoğraf yalnız destekleyici delildir; bilinen teknik uyuşmazlığı geçersiz kılamaz. Farklı çekim doğru ürünü otomatik reddetmez. Fotoğraf okunamadığında doğrulanamadığı açıkça gösterilir. Bu işlem nesne tanıyan bir yapay zekâ değildir.
- Fotoğraf kontrolü ürün fiyatını bekletmez; ayrı, süre ve boyut sınırları olan istekle yapılır. Yalnız kayıtlı mağazalar ve mevcut mağaza CDN adresleri okunur.
- JSON-LD ile görünen ürün başlığı çelişirse kayıt reddedilir. Fiyatın alternatif URL'si ancak aynı mağazanın sayfada ilan ettiği canonical adresi ise kabul edilir. Robiz `/comm/usbttlch340g` → `/usbttlch340g` örneği bunun gerçek regresyonudur: 85,26 TL, stokta, KDV ve minimum adet doğrulanmıştır.

Kontroller: 161 otomatik test, tür kontrolü ve üretim derlemesi. Genel karşılaştırmalar önceki 2.225 gerçek fiyat/stok/satış birimi gözlemi üzerinde tekrar oynatılır; bu eski gözlemlerin kontrol tarihleri yenilenmez. Yeni mağaza gözlemi ve yayındaki A/B denemelerinin sonuçları `outputs/matching-general/` altında tutulur. A/B seçimi, kargo hesabı, sepet seçenekleri ve ortak sepet davranışı korunur.

