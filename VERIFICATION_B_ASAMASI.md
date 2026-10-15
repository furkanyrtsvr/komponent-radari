# B aşaması: toplu katalog ve zamanlı fiyat arşivi

A aşaması kaynak etiketi: `a-asamasi-2026-10-03`; kaynak SHA `1f70313ccb66283f71db6a577c4f18347586620b`. Yayın sürümü 23. ZIP: `outputs/EN_UCUZU_BURADA_A_ASAMASI_2026-10-03.zip`.

Varsayılan A aşamasıdır. Fiyat kaynağı seçicisinden B açılır. A önce 20 dakikalık, B önce 12 saatlik arşiv kaydını kullanır. Süre dolduğunda canlı okuma denenir; başarısız olursa son gerçek fiyat kontrol tarihi değiştirilmeden gösterilir ve sepet hesabında kullanılabilir. Geçmiş stok bilgisi yeni kontrol yapılmış gibi sunulmaz. B eksik kayda canlı fiyat uydurmaz. Her iki aşamada sepet ve eşleştirme kuralları, stok, paket ve kargo hesabı korunur. A'ya aynı seçiciden dönülür; tam kaynak geri dönüşü etiket/ZIP ile yapılır.

## Veri yolu

`scripts/catalogue-b.ts` tüm 14 mağazanın mevcut sitemap kataloğunu SQLite'a indeksler. `work/catalogue-b/catalogue.sqlite` kalıcı kuyruk, tarihli fiyatlar ve geçmişi içerir. Aynı mağaza/adres benzersizdir. Başarısız okumalar eski fiyatın tarihini değiştirmez. Yeni sitemap kuşağı tamamlanmadan eski adresler pasif yapılmaz.

`scripts/run-catalogue-b.ps1` bilgisayar ağından normal HTTPS okuyucularını çalıştırır. Robotzade/Robitshop için yayımlanan sunucudaki 403 engelini aşmaya çalışmaz; bilgisayardan erişilebilen aynı kamuya açık sayfaları okur. Robots ve Crawl-delay gözetilir. Her mağaza sırayla okunur, mağazalar bağımsız ilerler. `--limit` mağaza başına kayıt sayısıdır; her çalışmada kaldığı yerden devam eder. Sepetteki adresler önceliklidir. Bir sonraki deneme/kontrol zamanı saklanır.

Aktarım `/api/catalog-snapshot` üzerinden ayrı servis anahtarıyla yapılır. Anahtar kaynak koda veya tarayıcıya konmaz. Yerelde yalnız Windows kullanıcısının açabileceği DPAPI şifrelemesiyle `work/catalogue-b/ingest-secret.dpapi` içinde tutulur. Bu klasör yayın kaynaklarına dahil edilmez. Anonim fiyat yazma kapalıdır. Mağaza/HTTPS, tarih, TRY/KDV, satış adımı ve fiyat doğrulanır. Eski veya tekrarlı aktarım yeni fiyatı değiştirmez.

## Tam kapsam

Katalogdaki adresler ürün fiyatı anlamına gelmez. İsim/kategori ilk durumda URL'den çıkarılır; gerçek ürün okununca başlık gerçek mağaza başlığı olur. Fiyat alanı doğrulanana kadar boştur. Stokta olmayan ürünün fiyatı saklanabilir, satın alınabilir teklif sayılmaz. Adres sayısı 1.058.051; çoğu Özdisan'dadır. IdeaSoft mağazalarının 30 saniyelik Crawl-delay süresi nedeniyle bütün adresleri günde iki kez sayfa sayfa yenilemek mümkün değildir.

Toplu destek için `--feed=dosya.jsonl`: her satır `{storeId,checkedAt,product}`; ürün şeması `lib/catalog-snapshot.ts`. Sadece yetkili mağaza verileri, gerçek kontrol zamanı, TRY/KDV dahil fiyat ve doğrulanmış satış birimi kabul edilir. Mağazadan alınacak XML/CSV, alan ve KDV eşleştirmesi doğrulanarak bu şemaya dönüştürülmelidir. Kamuya açık doğrulanmış toplu fiyat akışı bulunmadığı için tahmini feed adresi veya fiyat eklenmemiştir.

Excel aynı SQLite kayıtlarından kategori sayfalarıyla üretilir. Fiyatlar TL, kontrol tarihi ve okuma hatası ayrı sütunlardadır. Excel veri tabanının sunumudur; uygulama her aramada milyon satırlık Excel açmaz.

## Zamanlı çalıştırma

Yerel toplayıcı için Codex'in zamanlı görevi bu çalışma alanında `scripts/run-catalogue-b.ps1` çalıştırır ve Excel'i yeniler. Windows bilgisayarı ve Codex açık olmalıdır. Cloudflare içinde reddedilen mağazalar için bu makine kapalıyken veri toplama garantisi verilmez. Tam bulut çalışması için mağazanın yetkili toplu veri erişimi veya ayrı sürekli açık toplayıcı gerekir.

Görev her çalışmada bu belgenin güncel hâlini okur. Çalışma dizini `app`; önce `scripts/run-catalogue-b.ps1 -Limit 250 -KnownOnly` çalıştırılır. Başarıdan sonra `node scripts/export-catalogue-b.mjs` aynı kategori Excel'ini atomik olarak yeniler. API aktarımı hatalıysa sıradaki çalışmada yeniden denenecek kayıtlar silinmez. Anahtarın içeriği hiçbir çıktıya yazılmaz. Bir başka toplayıcı çalışıyorsa ikinci çalıştırma durdurulur. 3 Ekim son denemesinde 2.225 gerçek mağaza ürünü doğrulandı. -KnownOnly seçeneği sepet bağlantılarını ve daha önce fiyatı okunmuş ürünleri yeniler; milyonluk okunmamış adres kuyruğu fiyat yenilemesini geciktirmez. Normal toplama seçeneği ayrıca yeni ürün keşfini sürdürebilir. Mağaza başına sınır 250; robots bekleme aralıkları korunur. Henüz tüm adreslerin fiyatı toplanmış değildir.

## İlk B aşaması kontrolü (3 Ekim 2026, son geniş denemeden önce)

- 1.058.051 adres SQLite'a alındı. Excel 13 kategori + Özet sayfasında aynı adres sayısını içeriyor; ZIP bütünlüğü, her kategori satır sayısı ve bütün sayfaların görünümü kontrol edildi.
- 17 gerçek fiyat okundu ve yetkili aktarım ile yayımlanan arşive kaydedildi. Özdisan'daki bir üründe satış adımı doğrulanamadı; fiyat boş bırakıldı, hata Excel'e kaydedildi.
- Robotzade HC-SR04: 39,00 TL / stokta. Robitshop HC-SR04: 40,29 TL / stokta yok. Kontrol zamanları arşivden ekrana aktarılırken değiştirilmedi.
- Yayında B önizlemesi 561 ms, linkten ekleme/karşılaştırma 3.478 ms sürdü. Stok dışı Robitshop fiyatı satın alınabilir teklife alınmadı. İzole misafir sepetindeki kontrol satırı sonra kaldırıldı.
- Yetkisiz fiyat aktarımı HTTP 401 ile reddedildi. A varsayılan, B seçilebilir ve A'ya geri dönüş kontrol edildi.
- 131 test geçti; tür kontrolü ve üretim derlemesi tamamlandı.
- Yerel zamanlı görev `en-ucuzu-burada-b-fiyat-ar-ivi`, her gün Türkiye saatiyle 08:00 ve 20:00 için ACTIVE durumunda oluşturuldu. Görev henüz planlı ilk çalışmasını yapmadı. Yerel ağ ve DPAPI anahtarı ile fiyat yazma ve yayından geri okuma elle başarıyla doğrulandı.

## Son geniş doğrulama

2.520 ayrı mağaza bağlantısı 14 mağazadan okundu. 2.225 fiyat/stok/satış birimi doğrulandı; bunlar 1.859 model/kimlik grubu ve 13 kategori içerir. 2.225 sepet/eşleştirme kontrolü ve yayımlanan B arşivinden 2.225 fiyat/stok/paket kontrolü geçti. 295 sayfada fiyat/KDV/satış miktarı doğrulanamadı veya sayfa kaldırılmıştı; fiyat uydurulmadı. Ayrıntı: VERIFICATION_2026-10-03_FINAL.md.

## Planlı arşiv turu · 4 Ekim 2026

`-Limit 250 -KnownOnly` ile mevcut 14 mağaza kontrol edildi. 2.492 gerçek gözlem yenilendi ve aynı sayıda kayıt başarıyla aktarıldı; aktarım hatası yok. 99 okumada fiyat/KDV/ürün verisi doğrulanamadı veya sayfa bulunamadı; bu sonuçlar yeni fiyat olarak yazılmadı. Eski fiyatı bulunan 89 başarısız okumada hem kayıt hem payload içindeki gerçek kontrol tarihi aynen kaldı. Mağaza başına 250 sınırı ve Robotzade/Robitshop bekleme aralıkları korundu.

Yayındaki B arşivinden mağaza başına bir yeni kayıt, toplam 14 örnekte fiyat, stok ve kontrol zamanı yerel gerçek gözlemle birebir karşılaştırıldı. Yetkisiz aktarım HTTP 401 ile reddedildi. İzole deneme oturumu A'ya geri alındı; kullanıcının sepetleri değiştirilmedi.

Ardından kategori Excel'i atomik yenilendi. 1.058.051 adres, 13 kategori + Özet ve 2.718 tarihli okunmuş fiyat içeriyor. ZIP bütünlüğü ve bütün kategori satırları kontrol edildi; dolu fiyatların tamamının fiyat, stok, tarih, paket, satış adımı ve minimum miktarı SQLite ile karşılaştırıldı. TL ve tarih sütunları sayısal hücreler ve uygun sayı/tarih biçimleriyle saklanıyor. Özet ve kategori önizlemeleri incelendi. Boş fiyatlar sıfıra çevrilmedi. Yerel raporlar `outputs/catalogue-b/heartbeat-production-2026-10-04.json` ve `excel-verification-2026-10-04.json` altında; bu çalışma verileri GitHub kaynak paketine girmez.
