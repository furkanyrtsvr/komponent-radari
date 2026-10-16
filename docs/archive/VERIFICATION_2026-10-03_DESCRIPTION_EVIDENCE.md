# Genel açıklama ve teknik özellik eşleştirmesi — 3 Ekim 2026

Kısa/yanlış yazılmış ürün adının tamamlanması tek ürün veya model için bir istisna değildir. `public/catalog/product-evidence.js` bütün okuyucuların aynı ürün kaydındaki açıklama ve teknik tablolarını ortak şekilde işler. Görünen mağaza adı korunur; arama ve kimlik için ayrıca teyit edilmiş ad oluşturulur. URL metni ürün doğrulaması değildir.

Ürünün kendi açıklamasındaki başlık veya girişteki ürün adı, gerçek başlıktaki model numarası ve belirtilen elektrik değerleriyle karşılaştırılır. Model numarası ve sayılar bulanık eşleştirilmez. İşlevi belli röle/sürücü/şarj kartları, aynı işlemcili genel geliştirme kartlarından ayrılır; kanal sayısı da teknik farktır. Adı kısaltılmış veya yazımı bozuk bir ürün türü, yalnız aynı açıklamada açık karşılığı varsa tamamlanır. Açıklamadaki önerilen ürünler, uyumluluk örnekleri ve ek model numaraları ürüne dönüştürülmez. Bileşen ile modül, sensör ile prob, motor ile sürücü ayrı kalır.

Teknik tablolardaki direnç, kapasitans, indüktans, çıkış voltajı, kılıf, montaj, pin sayısı, renk ve konnektör bilgileri korunur. 100nF ile 0,1µF aynı kapasitedir; farklı değerler veya açık donanım farkları en ucuz teklif hesabına katılmaz. 2N/1N gibi rakamla başlayan model kodları da aynen korunur. Bilgi bulunamazsa açıklamanın doğruladığı iddia edilmez.

Her teklif kendi mağaza açıklamasıyla kontrol edilir. Daha önce birleşmiş kayıtlarda başka mağazanın açıklaması teklifin yerine kullanılamaz. Asıl kaynak yeniden okununca, aynı gerçek başlığı taşıyan eski kaydın açıklaması güncellenebilir. Ortak kontrol canlı A ve arşiv B sonuçlarında uygulanır; gözlem zamanı yenileme yapmadan ileri alınmaz.

İşlenen bilgiler sınırlı önbelleklerde yeniden kullanılır. Sepet tekliflerindeki kendi ürün kayıtları bir kez hazırlanır. Uzun açıklamalar her teklif kopyasıyla tarayıcıya tekrar gönderilmez; değerlendirme sonucu gönderilir. Bu değişiklik önceki yayın denemesinde açılışta görülen işlem süresi sorununu da hedefler. Yayın sonrası açılış ve A/B raporları aşağıdaki klasöre kaydedilir.

## Tamamlanan kaynak kontrolleri

- 175 otomatik kontrol geçti; tür kontrolü hatasız.
- Kısaltma/yazım bozukluğu ve kendi açıklaması 16 farklı ürün türünde sınandı: regülatör, sensör, şarj modülü, motor sürücüsü, zamanlayıcı entegre, kondansatör, direnç, termistör, bobin, LED, konnektör, kristal, sigorta, sensör probu, transistör ve diyot. Bu örnekler kontrollü test verileridir.
- Önceden gerçek sayfalardan alınmış 2.225 gözlemle sepet, fiyat, stok ve varyant kontrolünün tamamı geçti. 1.010 mağaza ürünü için başka mağaza ilişkisi bulundu; 4.252 bilinen farklı aday ilişkisi hesap dışında kaldı. Bunlar yeni canlı okumalar değil, gerçek tarihleri korunmuş gözlemlerin yeniden değerlendirilmesidir.
- 13 katalog kategorisinden 13 sayfa yeniden canlı okundu. Her sayfanın fiyatı ve stoğu okundu; kendi açıklamasından ad teyidi elde edildi. Gerçek kategori etiketi ürün türünden farklı olabilir; tür mağazanın kendi adı/açıklamasından çıkarılır.
- Ayrı 1K örneğinde dokuz mağazanın bağımsız fiyatları okundu; bu özel örneğin kaydı `VERIFICATION_2026-10-03_ABBREVIATIONS.md` içinde tutulur.

## Denetim dosyaları

`outputs/description-evidence/`: tarihli canlı gözlemler, açıklama kapsamı ve sepet işlem ölçümü, otomatik kontrol çıktısı ve yayın sonrası denemeler.

`outputs/matching-abbreviations/replayed-comparisons.json`: 2.225 kaynak için fiyat/stok/hesap sonuçları ve dışlanan teknik farklar.

Ölçülen örnek yerel bilgisayardaki 2.225 ürünün toplu teklif ilişkilendirmesidir; canlı mağaza ağ hızının veya her ortamın süresinin garantisi değildir. Mağaza sayfası eksik veya erişilemez olduğunda son gerçek fiyat ve kontrol tarihi kullanılabilir; eksik teknik bilgi doğrulanmış bilgiye çevrilmez.
