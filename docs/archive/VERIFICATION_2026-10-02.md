# 2 Ekim 2026 — canlı fiyat bekleme düzeltmesi

## Sorun

Sayfa açılışındaki otomatik fiyat kontrolü genel işlem kilidini kullanıyordu. Aynı mağazada çok sayıda aday adres sırayla okunuyor; her yönlendirme yeni bir bekleme süresi açabiliyordu. En yavaş mağaza bütün yenilemeyi ve ekran işlemlerini bekletiyordu. İstek hata verdiğinde başlangıçtaki “Mağazalardan canlı fiyatlar alınıyor…” metni temizlenmediği için işlem bitmesine rağmen ekranda kalabiliyordu.

## Yeni davranış

- İlk açılış, elle yenileme ve 15 dakikalık kontrol bağımsız arka plan işlemi kullanır. Arama ve sepet işlemleri kullanılabilir; yalnızca tekrar fiyat yenileme düğmesi kontrol bitene kadar kapanır. Geçen süre gösterilir.
- Sunucuda canlı fiyat ağ taramasının toplam bütçesi 20 saniyedir. Başlamayan adaylar ertelenmiş olarak bildirilir; doğrulanmış fiyatların kaydı tamamlanır. Ağ süresinin dışında veri sorgulama/kaydetme süresi bulunabilir.
- Bir ürün sayfasının robots, yönlendirme ve gövde okuması ortak süre sınırını paylaşır. Her HTTP isteği en fazla 8 saniye, toplam ürün okuması en fazla 12 saniye ağ bütçesi kullanır. Yönlendirme veya bitmeyen yanıt yeni sınırsız bekleme yaratmaz.
- Her sepet ürünü ilk adayını kontrol ettirmeden diğer ürünün bütün alternatifleri denenmez. Önceden doğrulanan adreslere öncelik verilir. Aynı mağazada güncel ve stokta doğrulanmış teklif varsa otomatik açılışta bilinmeyen/başarısız alternatifler tekrar taranmaz; bilinen ama süresi dolan teklifler yenilenir. Elle yenileme alternatifleri de kontrol eder.
- Tarayıcıdaki fiyat isteği 30 saniyede sonlanır. Başarı, erişim sorunu ve zaman aşımı durumunda durum metni ve gösterge kapanır. Hata eski bir “alınıyor” metni bırakmaz.
- Model, paket, KDV ve stok doğrulama kuralları korunur. Süresi dolmuş veya doğrulanmamış fiyat hesaplamaya alınmaz.

## Kontroller

- 103 otomatik test geçti. Yeni kontroller iptal edilen ortak robots beklemesi, geç hata, sepet ürünleri arasında adil sıra, iptal edilmiş isteğin başlamaması, yönlendirme ve bitmeyen ürün gövdesini kapsar.
- TypeScript kontrolü geçti. Sepet/paylaşım API regresyonu geçti.
- Gerçek mağazalarla yerel zorunlu yenileme 9,69 saniyede tamamlandı: 36 teklif güncellendi, 50 bağlantı doğrulanamadı, ertelenen bağlantı olmadı. Bu bir tarihli ölçümdür; her ağ koşulunda aynı süreyi garanti etmez.
- Tarayıcıda fiyat kontrolü sürerken HC-SR04 arama alanına yazılabildi ve “Ürün ara” düğmesi açık kaldı. Geçen süre ve bitiş durumu kontrol edildi.

Yayın aynı proje ve mevcut erişim ayarıyla yapılır: https://en-ucuzu-burada.furkanyurtsev6.chatgpt.site

## Açılış zaman aşımı düzeltmesi

Yayındaki `/api/config` isteği 65 saniyede tamamlanmadı. Worker kayıtları aynı rota için iptal edilmiş istekler gösterdi. Rota, salt okunur açılış ayarlarını döndürmeden önce veritabanına hız sınırı kaydı ve örnek veri hazırlığı yapıyordu. Tarayıcıdaki 10 saniyelik sınır ham “signal timed out” hatasını gösteriyordu.

- Açılış ayarları veritabanı sorgusu ve örnek veri hazırlığından önce döner.
- Hazır veritabanında örnek veriler tekrar yazılmaz. Eksik kayıtlar ebeveyn/çocuk sırasına uygun, en fazla 80 kayıtlık idempotent gruplarla eklenir. Mevcut mağaza ayarları ve canlı fiyatlar değiştirilmez.
- Ortak hazırlık 15 saniyede sonuçlanmazsa bekleme sonlanır ve sonraki deneme yeni işlem başlatabilir. Geç gelen hata başarılı yeni işlemi bozmaz.
- Tarayıcı zaman aşımı Türkçe ve anlaşılır gösterilir.
- 107 otomatik test geçti; gerçek SQLite şemasıyla yabancı anahtar bütünlüğü, yeniden hazırlıkta mevcut verilerin korunması ve takılan hazırlıktan sonra tekrar deneme test edildi. TypeScript kontrolü ve 20 sepet/paylaşım API kontrolü geçti.
- Yerel açılış ölçümü: config 173 ms, bootstrap 110 ms; 47 ürün ve 10 mağaza yüklendi. Yayın kontrolü ayrıca gerçekleştirilir; yerel ölçüm yayın performansının garantisi değildir.
