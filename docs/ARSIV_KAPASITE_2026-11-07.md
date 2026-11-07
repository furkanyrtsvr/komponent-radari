# Arşiv kapasitesi ve güvenli devam

183.118 bağlantılık ilk tarama kuyruğu korunur. Fiyatlar, görseller, sepetler ve
hazır sürümler sıfırlanmaz. Eski yayımlanmış hazırlık kopyaları 250 satırlık
sayfalar halinde R2'ye içerik özetiyle yedeklenir. Dosyanın boyutu ve özeti
doğrulanmadan D1'den çıkarılmaz. Aktif, henüz yayımlanmamış ve eski dosya
indeksi olmayan sürümler korunur. Bakım tarama ve yayın öncesinde çalışır;
her iki süreç de yarım kalan bakımı güvenle tekrar edebilir.

Yayıncının büyüyen SQLite kontrol noktası tek 96 MB isteği yerine 24 MB
parçalarda saklanır. Her parça sunucuda SHA-256 ile doğrulanır; bütün parçalar
hazır olmadan kontrol noktası işaretçisi değiştirilmez. Eski tek dosyalar da
okunmaya devam eder. HTTP aktarımı dosyayı dönüştürmemelidir.

Toplayıcı aynı işin yeterince yeni ve SQLite bütünlüğü sağlam yerel kuyruğunu
korur. Uzaktaki dosya okunamıyorsa doğrulanmamış yerel kayıt asla son güvenli
kontrol noktasının üzerine yazılmaz. Beklenen ilerlemeden eski kuyrukla tarama
başlatılmaz. Mevcut fiyat ve görseller yeniden kullanılmaya devam eder.

Yeni kontroller: `tests/archive-capacity-2026-11-07.test.ts`. Eski test takımları
bu değişiklik için çalıştırılmaz.
