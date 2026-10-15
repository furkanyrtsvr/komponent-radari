# 2 Ekim 2026 alışveriş ve üyelik doğrulaması

Kaynak proje, mevcut Sites projesi ve ana tasarım korunmuştur.

- 110 birim/regresyon testi geçti. SQLite üzerinde dört migrasyon, soğuk başlatma, eşleştirme, miktar/ambalaj, KDV, stok ve mağaza sayısı matematiği kontrol edildi.
- TypeScript denetimi geçti.
- Bayraksız yerel `shopping-api.mjs`: 32 kontrol geçti; demo reddi, sepete özel kargo, yetki sınırları, rol yükseltme, üye çıkarma, fiyat/stok takibi ve platform hesabına misafir verisi aktarımı. Aynı yerel platform hesabı başka oturumda aynı sepete ulaştı. SSE değişiklik iletimi yaklaşık 1 saniye.
- Eski `api-smoke.mjs`: yerel geçici `ENABLE_TEST_DATA=true` ile 20 kontrol geçti; test bayrağı kaldırıldı.
- Gerçek Direnç.net HC-SR04 bağlantısı, 3 adet: otomatik sepet ekleme ve 7 mağazada farklı güncel tutarla karşılaştırma yaklaşık 9,8 saniyede geçti. Tarayıcı kontrolünde önbellekteki Motorobit teklifiyle 8 mağaza listelendi.
- Bu kontrolde kargo dahil toplamlar: SAMM 227,36 TL; Robo90 238,76 TL; Robolink 242 TL; Direnç.net 254,36 TL; RobotSepeti 260,78 TL; Robotistan 268,22 TL; Motorobit 287 TL; Robiz 326,96 TL. Bunlar test anının 80 TL tahmini kargo kullanılan sonuçlarıdır; sabit fiyat veya satıcı garantisi değildir.

En fazla N mağaza seçeneği daha az mağaza kullanabilir; 2 mağazalı plan hâlâ en ucuzsa 3–10 üst sınırında aynı toplam doğrudur. Tam N mağaza seçeneği gerçekten N sipariş kullanır; yeterli uygun ürün/mağaza yoksa çözüm gösterilmez.

Bağlantı karşılaştırması mevcut 10 elektronik mağazayla sınırlıdır. Farklı model, kablo yönü/uzunluğu, kart sürümü ve paketler otomatik birleştirilmez. CAPTCHA/giriş veya tutarsız satış sayfasında doğrulanamayan teklif hesaba katılmaz.

Takip uygulama açıkken 15 dakikada bir çalışır. Kapalı uygulamada zamanlanmış kontrol ve e-posta/push gönderimi bağlı değildir. Kargo paneli kullanıcı tarafından tanımlanan kurallardır; adres/desi/kupon nedeniyle ödeme ekranının nihai tutarı değişebilir. Supabase migrasyonu kaynakta vardır; harici Supabase anahtarları olmadığından PostgreSQL/OAuth gerçek servis denemesi yapılmamıştır.
