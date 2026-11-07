# Arşiv kapasitesi ve güvenli devam

183.118 bağlantılık ilk tarama kuyruğu korunur. Fiyatlar, görseller, sepetler ve
hazır sürümler sıfırlanmaz. Eski yayımlanmış hazırlık kopyaları 250 satırlık
sayfalar halinde R2'ye içerik özetiyle yedeklenir. Dosyanın boyutu ve özeti
doğrulanmadan D1'den çıkarılmaz. Aktif, hâlâ yayımlanabilecek hazırlıklar ve eski dosya
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

Aktif sürümün kontrol tarihinden eski yarım hazırlıklar artık yayımlanamayacağı
için aynı doğrulanmış yedekleme işlemine dahildir. Yeni hazırlık 500 kayıttan
büyük kopyalama yapmaz; kaynak kimlikleri tek JSON parametresinde gönderilir.
İlerleme her sayfada saklanır; tamamlanmamış hazırlık yayımlanamaz. Hazır
teklif aktarımı en fazla altı eşzamanlı, 20 kayıt / 600 KB sınırındaki istekle yürür. D1 geçici yük
sınırında bekleme/yeniden deneme, yer yetersizliğinde doğrulanmış yedekle
alan açma vardır. Tamamlandığı GitHub üzerinden doğrulanan eski işçinin
kilidi güvenli kontrol noktası korunarak serbest bırakılabilir.

Yayın hazırlığı bütün fiyatları D1 içinde tekrar kopyalamaz. Mevcut fiyatlar
kontrol tarihi sınırıyla sayfalı okunur; önceki donmuş gözlemler korunur.
Yalnız görseli hazırlanmış teklifler, kaynak ürün kimliği ve gerçek kontrol
tarihi doğrulanarak hazırlığa kaydedilir. Tamamı hâlâ ana fiyat arşivinde ve
kalıcı kontrol dosyalarında bulunur. Yerel, ayrı D1/R2 API denetiminde tam
kopya oluşmadığı, eski gözlemin tarihinin korunduğu, daha yeni ana fiyatın
ezilmediği ve yanlış ürün kanıtının reddedildiği doğrulandı.

İlk uyarlamada bağımsız katalog sayfaları en fazla dört eşzamanlı okumayla
alınır. Hazır görsellerin boyut bilgileri kaynak katalog sayfasıyla birlikte
doğrulanmış önbellekten gelir; aynı görsel için ayrı ayrı ağ kontrolü
gerekmez. Bir sayfa hata verirse SQLite kapanmadan diğer okumalar tamamlanır.
Anahtar/tarih doğrulamaları ve istek boyutu sınırları korunur.
