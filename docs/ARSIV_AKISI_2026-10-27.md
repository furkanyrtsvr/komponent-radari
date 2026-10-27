# Bağımsız fiyat toplama ve artımlı yayın

Fiyat işçisi artık yayıncıyı çağırmaz. Her kısa fiyat turu sonunda mevcut
SQLite kuyruğunu R2 kontrol noktasına kaydeder ve aynı çalışma oturumunda
sonraki tura geçer. Üç saatlik oturum sonunda sıradaki iş doğrudan tetiklenir;
yarım saatlik GitHub zamanlayıcısı yalnız yedektir. Mağaza gecikmeleri ve
robots kuralları korunur. Duraklatma ve başarısızlık halinde zincir durur.

Yayıncı ayrı eşzamanlılık grubundadır. İlk geçişte yaklaşık saatte bir,
sonrasında 12 saatlik yayın aralığında çalışır. Katalog değişiklikleri
`catalog_archive_changes` sıra numarasıyla izlenir: geç yüklenen eski tarihli
fiyatlar ve aynı tarihli okuyucu düzeltmeleri atlanmaz. İlk geçiş bir defalık
mevcut fiyat kayıtlarından yayıncı durumunu oluşturur; toplayıcı kuyruğu
yeniden başlatılmaz. İlk uyarlama sürerken eski hazır katalog erişilebilir.

Yayıncı kendi SQLite kontrol noktasını R2'de saklar; GitHub önbelleği zorunlu
değildir. Değişmeyen gözlemler tekrar doğrulanmaz. Hazır ürün grupları yalnız
girdisi değişen bölümlerde yeniden oluşturulur. İçerik özetli katalog parçaları
aynıysa tekrar yüklenmez ve tarayıcıda da aynı kalıcı adresle önbelleklenir.
Yeni manifest bütün dosyalar hazırlandıktan sonra atomik olarak etkinleşir.
Fiyatın kontrol tarihi ancak yeni, doğrulanmış mağaza okumasıyla değişir.

Görsel adresi ile hazırlanmış WebP arasındaki eşleme kalıcıdır. Görselin yaşı
yeniden indirme nedeni değildir. Yeni bir görsel hazırlandığında eşleme hemen
sunucuya kaydedilir. Fiyat güncellense de aynı görsel tekrar indirilmez.
Yeni görsel henüz doğrulanamadıysa önceki tamamlanmış gözlem özgün tarihiyle
korunur. Sahte görsel, fiyat veya kontrol tarihi üretilmez.

Geçiş ekleyicidir: fiyatlar, eski katalog sürümleri, görseller, eski kontrol
noktaları ve ilk tarama ilerlemesi silinmez. Özdisan toplu taramanın dışında,
linkten eklemede kalır. GitHub hizmetinin başlatma gecikmesi tamamen kontrol
edilemez; zincirleme başlatma düzenli zamanlayıcıya bağımlılığı azaltır.

Yeni kontroller: `node --import tsx --test tests/incremental-archive-2026-10-27.test.ts`.
