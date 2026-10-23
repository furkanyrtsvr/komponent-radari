# Robot Sepeti, Robotistan ve sunucu erişimi — 23 Ekim 2026

223 otomatik test başarılı. KDV doğrulaması geçmeyen tutar kullanılmaz; teklif talebi isteyen ürün, mağaza entegrasyonunun bozuk olduğu anlamına gelmez.

## Robot Sepeti

Mağaza yeni T-Soft görünümüne geçmiş. Ana ürün içindeki `data-toggle="price-sell-vat"` ve `product-count-` alanları artık mağaza adından bağımsız tanınıyor. JSON-LD fiyatı, para birimi ve satış adımı kontrolü korunuyor. Üç gerçek sayfanın yeni parçaları testlere eklendi; fiyatı değiştirme, çelişen ikinci fiyat ve kapsam dışındaki öneri fiyatları sınandı.

İlk yayın sonrası sunucudan üç yeni gözlem doğrulandı: 470uH bobin 4,88 TL; 1000uF 35V kondansatör 7,92 TL; EFC16T-R-2 sensör 468,75 TL. Sensör stokta değil; fiyatın okunması stok bulunduğu anlamına gelmez. Bunlar gözlem anındaki tutarlardır.

## Robotistan

Sunucudaki yeni görünüm, adı KDV dahil olan alanlarda net tutarı döndürebiliyor. Bu alanın adı ve JSON-LD ile eşit olması tek başına Türkiye KDV dahil fiyat kanıtı sayılmıyor.

Yeni görünümde mağazanın kendi `PRODUCT_DATA` kaydı güvenli JSON olarak okunur; JavaScript çalıştırılmaz. Ana ürünün URL, başlık, kimlik, ürün kodu, alt varyantı ve hedef para birimi birlikte eşleşmelidir. Pozitif KDV oranı, hassas net tutar ve mağazanın yayımladığı toplam tutar tutarlı olmalıdır. Çıktı olarak mağazanın doğrulanan toplamı kullanılır; hesaplanmış bir tutar mağaza fiyatı diye uydurulmaz. Sıfır/belirsiz bölgesel KDV, eksik veri ve çelişkiler reddedilir. Klasik görünümde ayrı gösterilen net/gross fiyatlar ile JSON-LD karşılaştırması korunur.

Önceki Robotistan arşiv kayıtları yeni güvenli okuyucu kanıtı olmadan kullanılmaz; bu önlem ilk canlı denemede net tutarla oluşan kayıtları da kullanım dışı bırakır. Gerçek gözlem tarihi yenilenmez. Fiyat/model/KDV çelişkisi, eski fiyat döndürülerek başarılı yenileme sayılmaz. Aynı tarihli arşiv kaydı mevcut teklifin hata bayrağını silemez; yeniden doğrulanmış daha yeni gözlem gerekir.

## Robotzade, Robitshop, Ulutaş, F1 Depo

Doğrudan Sites sunucusu, bu mağazaların otomatik erişim kurallarını okurken 403 alıyor. Aynı kimlikle bilgisayardan okuma başarılı. Engelin mağaza tarafında hangi kuralla konduğunu mağaza günlükleri olmadan kesinleştiremeyiz. Robots kontrolü kaldırılmadı; proxy, kimlik gizleme veya güvenlik engeli aşma eklenmedi.

403'ün yeniden denenebilir hataya çevrilmesi düzeltildi. Bu gereksiz tekrarları önler; erişimi açtığı iddia edilmez.

Mevcut GitHub toplayıcısının 23 Ekim 13:37–13:38 UTC çalışması ayrıca denetlendi: Robotzade 3, Ulutaş 3, F1 Depo 3 ve Robitshop 2 yeni fiyatı doğruladı. Robitshop'ta bir eski bağlantı 404 döndü. Toplam turda 53 doğrulanan gözlem ortak arşive yüklendi. Bu yol doğrudan Sites anlık okuması değildir; B arşivinde gerçek kontrol tarihiyle kullanılır. Yeni bilgisayar görevi veya Türkiye sunucusu kurulmadı.

Özdisan'ın teklif talebi isteyen ürünleri hata olarak sınıflandırılmaz. Herkese açık fiyatı bulunan ürünler kendi KDV ve para birimi kontrollerinden geçmelidir; önceki bölgesel KDV sınırı korunur.
