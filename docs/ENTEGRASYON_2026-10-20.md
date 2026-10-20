# Altı mağaza entegrasyonu — 20 Ekim 2026

Pil Paketi, Pil Sitesi, E komponent, Ulutaş Elektronik, Hobi Devre ve F1 Depo için ürün okuyucuları, ürün adres dizinleri ve otomatik arşiv toplama bağlantıları eklendi. Katalog 20 mağaza, 1.159.064 adres içerir; yeni altı mağazanın toplamı 101.033 adrestir. Adres sayısı güncel fiyat sayısı değildir.

| Mağaza | Ürün adresi | Doğrulama yöntemi |
| --- | ---: | --- |
| Pil Paketi | 2,270 | QukaSoft: aynı ürünün JSON-LD fiyatı, ana fiyat alanı, KDV ve miktar kontrolü. |
| Pil Sitesi | 1,685 | Ticimax: ürün kimliği, eski/indirimli net fiyat, KDV dahil görünür fiyat ve sipariş adımı. |
| E komponent | 66,653 | T-Soft: ürün adı ile üretici kodunu ayırma; ana TRY fiyatı, KDV, stok ve miktar fiyatları. |
| Ulutaş Elektronik | 24,291 | IdeaSoft: net + KDV, hassas brüt hesaplama, çoklu paket ve stok birimi. |
| Hobi Devre | 1,642 | WooCommerce: ürün kimliğine bağlı güncel görünür fiyat ve sepete ekleme verisi, açık KDV ve miktar kontrolü. |
| F1 Depo | 4,492 | IdeaSoft: eski fiyat yerine indirimli net fiyat + KDV; stok dışı ve çoklu motor paketleri. |

## Kapsam sınırları

Pil Sitesi ürün XML site haritası 403 döndü. Engellenen uç nokta tekrar denenmeden, herkese açık menü kategorileri ve görüntülenen sayfalama bağlantıları tarandı: 1.685 ürün. Üç menü kategorisi 404 döndüğü ve XML listesi doğrulanamadığı için dizin arayüzde **kısmi** işaretlidir. Tekrar keşif aracı: `node --import tsx scripts/catalog/discover-pilsitesi.ts`.

Ulutaş için ilan edilen 49 ürün site haritasının tamamı, robots.txt içindeki 30 saniyelik istek aralığı korunarak alındı; 24.291 benzersiz adres, sıfır harita hatası. Pil Paketi beş, E komponent dört, F1 Depo dokuz ürün haritasından; Hobi Devre iki ürün haritasından alındı. WordPress kategori/marka haritaları ürün sayılmaz.

Fiyatı herkese açık olmayan Özdisan ve E komponent sayfaları için fiyat üretilmez; kullanıcıya mağazanın fiyat yayımlamadığı açıkça bildirilir. Zorunlu varyant veya çelişen satış bilgileri doğrulanmadan kabul edilmez.

## Mevcut mağazalardaki düzeltmeler

- Motorobit: açıklama metninin ürün kimliğini değiştirmesi düzeltildi; URL, başlık ve ürün kimliği kontrolleri korundu.
- Robiz: 140 parçalı kablo seti bir satış setidir; fiyat 140’a bölünmez.
- Robocombo: bozuk HTML ağacında kaybolan `__NEXT_DATA__`, yalnız doğru script kimliği ve JSON türüyle okunur; ürün/varyant kontrolleri korunur.
- Özdisan: teklif talebi isteyen sayfalar artık belirsiz hata yerine açık fiyat yok mesajı verir.
- IdeaSoft: Türkçe büyük harfli GELİNCE HABER VER doğru stok dışı durumu olur.

## Arşiv ve istek kararlılığı

`www` olan ve olmayan ürün adresleri aynı arşiv anahtarına çevrilir; eski gözlemler de iki adres biçiminden bulunur. Kontrol tarihi değişmez, varyant sorgusu korunur. A canlı okumadan sonra B modunda altı yeni mağazanın fiyatları 12 saatlik tarihli kayıttan başarıyla okundu.

Keşif kartlarının hızlı ardışık istekleri istek sınırına takılıyordu. Başlangıçlar en az 2,5 saniye aralıklıdır; 429 yanıtında bir dakika beklenir ve istek tekrar sıraya alınır. Zorunlu yenileme isteği korunur. Stok dışı ürünler fiyat doğrulama hatası gibi gösterilmez.

## Doğrulama

200 otomatik test; fiyat/KDV çelişkileri, yanlış ürün kimliği, varyant reddi, indirimli ve eski fiyat ayrımı, fiziksel paket/satış adımı, stok dışı durumları, arşiv adres eşdeğerliği ve istek bütçesi kapsanır. TypeScript kontrolü ve üretim derlemesi ayrıca çalıştırılır.

27 gerçek ürün sayfası örneğinde 25 doğrulanmış fiyat, iki herkese açık fiyat yayımlamayan ürün gözlendi. Örnekler pil, şarj cihazı, pil yuvası, direnç, RF/geliştirme kartı, sensör, vida paketi, trimpot, kondansatör ve motor paketlerini içerir. Bu bir örneklem denetimidir; her ürünün kesintisiz okunabileceği garantisi değildir.

Yerel Worker API testinde altı mağazanın tamamı A modunda fiyat döndürdü; aynı ürünler B modunda kontrol tarihi korunarak arşivden okundu. Canlı denetim aracı: `node --import tsx scripts/catalog/audit-integrations.ts`. Ağ ve mağaza verileri değiştiğinden tarihteki fiyatlar kalıcı fiyat taahhüdü değildir.

Otomatik fiyat iş akışı site kapalıyken de yarım saatte bir sınırlı turla devam eder. Bir milyondan fazla ürünün tümünü tek turda veya 12 saatte yenileme kapasitesi yoktur; kapsam ve başarısızlıklar uygulamada görünür.
