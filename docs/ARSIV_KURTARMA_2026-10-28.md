# Bellek ve aktarım hatalarının kurtarılması

28 Ekim kayıtları yayın sonlandırmasında Worker bellek sınırının aşıldığını,
fiyat işçisinin ise aktarım zaman aşımıyla durduğunu gösterdi. Güvenli kontrol
noktası 90.483 bağlantıydı; bu kuyruk ve eski hazır sürüm sıfırlanmaz.

- Yayın etkinleştirme işlemi artık büyük hazırlık tablosunu topluca silmez.
  Dosya doğrulaması en fazla altı dosyalık, tekrar edilebilir kontrol noktalarıyla
  yapılır. Bütün dosyalar doğrulanmadan etkin sürüm değişmez.
- Açılmış nesne önbelleği toplam 4 MB ile sınırlıdır. Büyük sıkıştırılmış
  dosyaların açılması sınırlı akışla yapılır; aynı anda tek dosya açılır.
  Eski hazır sürümden aktarımda bir istekte yalnız bir bölüm okunur.
- Başarısız yayının hazırlanmış tabanı yeniden kullanılabilir. Küçük revizyon
  listesi karşılaştırılır; yalnız farklı kayıtların gövdeleri alınır.
- Fiyat aktarımı en fazla 10 kayıt / 200 KB parçalarla yapılır. Ağ hatalarında
  yeniden deneme ve parça küçültme vardır; onaylanan parçalar hemen işaretlenir.
  Yanıt kaybolsa da aynı gözlemin yeniden gönderilmesi tarihini değiştirmez.
- Önce bekleyen fiyatlar aktarılır; ardından yeni bağlantılar taranır. Geçici
  aktarım hatası işi iptal etmez; güvenli kuyrukla yeniden denemeye alınır.
  Kalıcı doğrulama hataları ve kullanıcının duraklatması ayrı tutulur.
- Aynı işe ait daha yeni yerel kuyruk, eski sunucu kontrol noktasıyla ezilmez.
  Beklenen bağlantı sayısından eski bir kayıt varsa tarama sıfırdan başlatılmaz.
- Giriş API'si yalnız yazıcı modülünü yükler; her fiyat için ayrı istek durumu
  sorgulamak yerine toplu, tarih koşullu onay kullanılır. Gecikmiş gözlem gerçek
  kontrol tarihiyle kabul edilir; daha yeni fiyatı eski kayıtla değiştirmez.

Yalnız yeni kontroller: `tests/archive-recovery-2026-10-28.test.ts`.
90.483 kayıt ve 488 bekleyen fiyatla sıkıştırma/geri yükleme; kaybolan yanıt,
kısmi başarı, küçük parça yeniden denemeleri, bellek bütçesi ve güvenli otomatik
devam sınandı. Yerel gerçek API denetiminde 90 binden fazla hazırlık kaydı
silinmeden yayın etkinleştirildi; dosya denetimsiz etkinleştirme reddedildi.
