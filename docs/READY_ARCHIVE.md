# Hazır B kataloğu

B, doğrulanmış fiyatı ve önceden hazırlanmış ürün görseli olan tekliflerin sabit bir yayınıdır. Ürün açılması veya arama mağaza taraması başlatmaz. Fiyatı ya da görseli hazırlanamayan ürün bu sürümde gösterilmez; daha geniş bağlantı dizini A modundadır.

## Hazırlama ve yayın

`archive-publish.yml` 00:06 ve 12:06 UTC zamanlarında çalışır. Mevcut doğrulanmış gözlemler bir kesim tarihinde dondurulur. Görseller güvenli HTTPS kaynaklarından, robots kuralları ve mağaza gecikmeleri korunarak alınır. Her görsel en fazla 800×800 WebP, kalite 84 olarak hazırlanır; oran korunur, küçük görsel büyütülmez. Aynı kaynak görsel adresi kalıcı olarak yeniden kullanılır; fiyat yenilemesi görseli yeniden indirmez. Yeni ürünün veya kaynak görsel adresi değişen ürünün görseli bir kez hazırlanır. Görseller mağazanın bağlantısına bağımlı kalmadan R2 üzerinde içerik özetiyle saklanır. GitHub çalışma önbelleği silinse bile hazırlanmış görsel adresleri sunucudaki kalıcı kayıtlardan yeniden yüklenir; mağaza görselleri tekrar indirilmez. Görsel değişikliği fiyatın kontrol tarihini değiştirmez.

Katalog sıkıştırılmış, SHA-256 ile doğrulanan dosyalara ayrılır. Bütün dosyalar ve görseller yüklendikten sonra etkin sürüm tek işlemle değiştirilir. Başarısız hazırlamada önceki sürüm kalır. Tarayıcı dosyaları bir kez indirir; aramalar yerelde yapılır. Fotoğraflar aynı yayındaki hazırlanmış dosyalardan yüklenir. Açık oturumun detay ve sepet okumaları aynı sürüme sabitlenir.

12 saat, yayın hazırlama aralığıdır; 1,16 milyon bağlantının tamamının veya her fiyatın bu aralıkta yeniden okunduğu anlamına gelmez. Toplayıcı sınırlı turlarla gözlemleri günceller. Her fiyat kendi gerçek kontrol tarihini korur. 12 saatten eski fiyatlar eski olarak gösterilir ve güncel fiyat/stok sayılmaz. Yayımlanan ürün/teklif sayısı ve hazırlama tarihi ekranda görünür. İlk hazırlama ve süre sınırları kapsamı daraltabilir.

## Yetki ve veri

Hazırlama API mevcut toplayıcı yetkisini kullanır. Anahtar istemciye veya depoya yazılmaz. Hazır dosyalar ortak yayımdır; sepet ve kullanıcı bilgileri içermez. D1 güncel fiyat gözlemlerini, iş durumunu, görsel eşlemelerini ve geçici hazırlık satırlarını tutar. R2 görselleri, katalog dosyalarını ve yayımlanmış tam ürün kayıtlarını tutar. Tam ürün kayıtları özetle doğrulanan parçalara yazıldıktan sonra geçici hazırlık satırları aynı yayın işlemi içinde kaldırılır; eski sürümler R2 üzerinden okunmaya devam eder.

## Bu değişikliğin kontrolleri

`node --import tsx --test tests/ready-archive.test.ts`: yayın tutarlılığı, eski sürümün korunması, gerçek tarihlerin değişmemesi, WebP boyutu/oranı, özel ağ adreslerinin reddi, sıkıştırılmış dosya bütünlüğü ve fiyat/görseli olmayan kayıtların dışlanması. Eski genel test paketi yeniden çalıştırılmaz.


## Yönetici: ilk arşiv kurulumu

Yönetim panelindeki **İlk arşivi başlat** düğmesi sunucuda kalıcı bir iş oluşturur. Yalnız yönetici bu işi başlatabilir veya duraklatabilir. Özdisan, kullanıcının tercihiyle toplu taramadan çıkarılmıştır; linkten ekleme desteği korunur.

Mevcut yarım saatlik toplayıcı, etkin ilk arşiv işine öncelik verir. Her tur 12 dakikaya kadar ilk kez okunacak sayfaları toplar, ardından eksik görselleri hazırlar ve tam sürümü yayımlar. Çalışma uzun tek bir HTTP isteğine bağlı değildir. 12 saat bir çalışma dilimidir; dilim dolunca başa dönmez veya tamamlandı demez. İlk geçiş bitene kadar turlar devam eder. Mağazaların robots gecikmeleri, HTTP engelleri ve fiyat talebi olan ürünler nedeniyle toplam süre günlere uzayabilir.

Her tur sonunda ürün sırası ve okuma sonuçlarını içeren SQLite kontrol noktası sıkıştırılıp yetkili API üzerinden R2'ye kaydedilir. Bir sonraki tur bu noktadan başlar; GitHub çalışma önbelleği silinse bile ilk tarama kaybolmaz. Görseller ayrıca kalıcı kayıtlardan yeniden kullanılır. Kontrol noktası kişisel hesap veya sepet verisi içermez. Düğmeye tekrar basılması eşzamanlı ikinci iş oluşturmaz; süreli çalışma hakkı ve sürüm karşılaştırması eski işçinin yeni durumu ezmesini engeller.

Panel denenmiş bağlantı, fiyatı doğrulanmış kayıt, hazır teklif, henüz denenmemiş bağlantı ve son denemede hata veren kayıtları ayrı gösterir. Hiç ilerleme olmayan üç turdan sonra iş inceleme durumuna geçer. Sonuç eksikse tamamlandı sayılmaz. Duraklatma isteği çalışan turu güvenli kayda geçirir.

Yeni odaklı kontroller: `node --import tsx --test tests/archive-bootstrap.test.ts`.
