# 20 Ekim 2026 stabilite denetimi

Yerel ağdan gerçek mağaza sayfaları okundu. Altı kategori: direnç, kondansatör, sensör, güç/pil, kablo ve geliştirme kartı. Bu bir örneklem denetimidir; bütün katalog için başarı garantisi değildir. Örnekler `scripts/catalog/audit-stability.ts` ile tekrarlanabilir.

| Mağaza | Doğrulanan / denenen | Sonuç |
| --- | --- | --- |
| Robotistan | 6/6 | Fiyat, KDV ve satış birimi doğrulandı. |
| Robo90 | 6/6 | Fiyat, KDV ve satış birimi doğrulandı. |
| Direnc.net | 6/6 | Fiyat, KDV ve satış birimi doğrulandı. |
| Robiz | 5/6 | Bir kablo sayfasında KDV ve satış birimi doğrulanamadı. |
| Komponentci | 6/6 | Fiyat, KDV ve satış birimi doğrulandı. |
| Robot Sepeti | 6/6 | Fiyat, KDV ve satış birimi doğrulandı. |
| Motorobit | 5/6 | Bir güç/pil sayfasında KDV dahil fiyat ürün verisiyle uyuşmadı. |
| Robolink Market | 6/6 | Fiyat, KDV ve satış birimi doğrulandı. |
| Özdisan | 1/6 | Beş sayfada ürün teklifi belirsiz; karşılaştırmaya alınmadı. |
| Robitshop | 6/6 | Fiyat, KDV ve satış birimi doğrulandı. |
| Robotzade | 6/6 | Fiyat, KDV ve satış birimi doğrulandı. |
| Robotronik | 6/6 | Fiyat, KDV ve satış birimi doğrulandı. |
| Pil Paketi | 0/0 | Ürün adres dizini ve özel okuyucu entegrasyonu yok; bu turda ürün sayfası denenmedi. |
| Pil Sitesi | 0/0 | Ürün adres dizini ve özel okuyucu entegrasyonu yok; bu turda ürün sayfası denenmedi. |
| E komponent | 0/0 | Ürün adres dizini ve özel okuyucu entegrasyonu yok; bu turda ürün sayfası denenmedi. |
| Ulutaş Elektronik | 0/0 | Ürün adres dizini ve özel okuyucu entegrasyonu yok; bu turda ürün sayfası denenmedi. |
| Hobi Devre | 0/0 | Ürün adres dizini ve özel okuyucu entegrasyonu yok; bu turda ürün sayfası denenmedi. |
| F1 Depo | 0/0 | Ürün adres dizini ve özel okuyucu entegrasyonu yok; bu turda ürün sayfası denenmedi. |
| SAMM Market | 6/6 | Fiyat, KDV ve satış birimi doğrulandı. |
| Robocombo | 5/6 | Bir direnç sayfasının ürün JSON verisi okunamadı. |

SAMM satış adımı kontrolü ve Robocombo yeni Ikas altyapısı düzeltildikten sonra bu iki mağazanın 12 sayfası yeniden okundu. Tabloda son okumalar kullanılır. Eski Robocombo ürün adresleri 404 dönüyordu; güncel site haritasından 3.881 ürün adresi yenilendi.

Fiyatı, KDV durumu veya satış birimi doğrulanmayan ürün fiyat karşılaştırmasına alınmaz. Altı mağazanın özel okuyucu/adres dizini entegrasyonu henüz yoktur.

## Otomatik arşiv

GitHub Actions `catalog-archive.yml` yarım saatte bir sınırlı bir toplama turu yapar. SQLite kuyruk önbelleği turlar arasında korunur. Eski kayıtları yenileme ve henüz okunmamış ürünler arasında sıra paylaşılır. 1.058.031 adresin tamamı tek turda okunmaz; tüm kataloğun 12 saat içinde yenilenmesi mevcut kapasitede sağlanmaz. B modu sadece son 12 saatte doğrulanmış kayıtları güncel kabul eder. Mağaza sınırlamaları ve başarısız sayfalar kapsamı azaltır.

## Yerel doğrulama

183 otomatik test: kategori/ürün ayrımı, voltaj, akım, ölçü ve güç farklılıkları, okuyucu regresyonları, kuyruk adaleti ve 20 mağazanın kargo varsayılanları. TypeScript kontrolü ve üretim derlemesi ayrıca çalıştırılır. Canlı barındırma ve ilk otomatik tur sonuçları yayın sonrası kontrol edilir.
