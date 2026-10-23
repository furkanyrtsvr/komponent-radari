# Toplayıcı üzerinden mağaza güncelleme — 23 Ekim 2026

Robotistan, Robotzade, Robitshop, Ulutaş ve F1 Depo, Sites sunucusundan yeniden tekrar denenmek yerine mevcut GitHub toplayıcısıyla güncellenir. Yeni bilgisayar görevi, proxy veya Türkiye sunucusu kurulmaz.

## Kullanıcı akışı

- A modunda da bu beş mağazanın kaynağı **Toplayıcı arşivi** olarak gösterilir. Fiyatın gerçek kontrol tarihi ürün, bağlantı karşılaştırması ve sepet sonucunda korunur; arşiv tutarı anlık okuma diye sunulmaz.
- Doğrulanmış ve 12 saatten yeni kayıt kullanılabilir. Süresi dolan kayıt, normal hesaplamaya alınmaz. Kullanıcının açıkça seçtiği geçmiş fiyat seçeneği ayrı kalır ve kontrol tarihi gösterilir.
- Fiyat yoksa, süresi dolmuşsa veya kullanıcı yenileme isterse mağaza/URL için kalıcı bir iş oluşturulur. Bekleyen yinelenen istekler birleştirilir; ilk istek tarihi korunur. Tamamlanan/başarısız işin yeniden istenmesinde 15 dakika aralık vardır.
- Yenileme sıradaysa durum açıkça gösterilir. Başarısızlık boş fiyat veya hata durumudur; eski fiyatın kontrol tarihi yenilenmez.

## Toplayıcı akışı

Kuyruk mevcut `scrape_jobs` tablosunda `collector_pending`, `collector_completed`, `collector_failed` durumlarını kullanır. Toplayıcının mevcut yetkili GET isteği hem izlenen ürünleri hem bekleyen yenilemeleri alır. Yenilemeler katalogda henüz bulunmayan geçerli mağaza bağlantılarını da kuyruğa ekler; istek tarihi sırasıyla önceliklendirilir. Normal keşif ve bilinen fiyat kuyruğu kalan kapasitede çalışır.

Başarılı ve doğrulanan arşiv yüklemesi, ilgili isteği tamamlar. Önceki isteğin geç gelen hata sonucu daha yeni isteği kapatamaz. İşlem yarıda kalırsa sonraki tur kuyruğu ve gönderilmemiş gözlemleri korur. Başarısızlıkta yerel fiyat tarihi değişmez ve tekrar bekleme süresi korunur.

Eski ürün yolu mağazanın kendi yeni HTTPS yoluna yönlenirse, gözlemde hem istenen hem gerçek ürün adresi saklanır; ilk istek anahtarı kaybolmaz. Aynı mağazanın eski HTTP yönlendirmesi yalnız HTTPS karşılığına dönüştürülür; hiçbir HTTP isteği gönderilmez. Yabancı alan adı, kullanıcı bilgisi ve farklı port reddedilir. Robots ve istek aralıkları korunur.

## Robotistan güvenliği

Toplayıcı da aynı kimlik/SKU/URL/para birimi/KDV/toplam kontrollerini uygular. Türkiye KDV kanıtı bulunmayan veya sıfır KDV gelen Robotistan kaydı arşive kabul edilmez. Önceki kanıtsız kayıtlar güncel arşiv sayaçlarına ve normal fiyat hesabına dahil edilmez. Eksik vergiyi ekleyerek mağaza fiyatı üretme yoktur.

## Kontroller

235 otomatik test geçti. Yeni testler istek birleştirme, yeniden deneme sınırı, eski yanıtın yeni isteği kapatmaması, katalog dışındaki URL, istek sırası, hata bekleme süresi, 12 saat sınırı, kaynak etiketi, yanlış KDV kanıtı, güvenli yönlendirme ve URL takma adlarını kapsar. Tür kontrolü ve üretim derlemesi ayrıca uygulanır.

Yerel HTTP denemesinde aynı iki ürüne yinelenen istekler iki kalıcı işte kaldı; kayıt yokken fiyat boş ve `collectorPending` doğru döndü. Yetkisiz toplayıcı okuma/yazma ve sonuç bildirimleri reddedilir. Yayın sonrası gerçek toplayıcı turu, kaynak dosyalarının dışında tarihli çıktılarla ayrıca doğrulanır.

Mevcut iş akışı her saatin 13. ve 43. dakikası için yapılandırılmıştır. GitHub zamanlayıcısının tam başlama/bitiş saati garanti değildir; yeni isteğin hemen tamamlanacağı iddia edilmez.
