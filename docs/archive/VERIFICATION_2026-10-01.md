# 1 Ekim 2026 geliştirme ve doğrulama kaydı

Mevcut uygulamanın ekranları, sepet yapısı ve aynı Sites projesi korunmuştur. ZIP içindeki başlangıç ve proje dokümanları okunmuş; ürün eşleştirmesi, mağaza fiyatları ve kargo dahil karşılaştırma geliştirilmiştir.

## Düzeltilen davranışlar

- Ürün kimliği modelin yanında voltaj, direnç/güç, kılıf, kamera, servo dönüş türü, kablo yönü/boyu/adedi, kart sürümü ve açık üretici bilgilerini korur. Soğutucu, shield, prob ve çıplak entegre ilgili modülle birleştirilmez. Sayısal arama 1K/51K veya 3.3V/33V değerlerini ayırır.
- Site haritasındaki kısaltılmış isimler keşif adayıdır. Gerçek ürün başlığı ve teknik açıklama kabulden önce doğrulanır. Kondansatörlerde doğru voltajlı adaylar mağaza başına okuma sınırından önce seçilir.
- Her teklif kendi mağazasının ana ürün bölümünden okunur. Önerilen başka ürünlerin fiyatları, belirsiz varyantlar ve yanlış temel para birimi kullanılmaz. Komponentci Türkçe karakter kodlaması, SAMM seçili fiyat listesi ve Özdisan miktar fiyatları için özel okuyucular uygulanmıştır.
- Paket miktarı, minimum sipariş ve satış adımı ayrı değerlendirilir. Özdisan'da MPQ satış minimumu sayılmaz; hassas net fiyat önce ara toplamda, sonra KDV eklenirken kuruşa yuvarlanır.
- Sepet ürünleri ve teklifleri kimliklerine göre sayfalanır; genel 1.000 kayıt sınırı aktif sepeti düşürmez. Yeni ürün veya paylaşılmış sepet açıldığında ilgili katalog kayıtları yüklenir.
- Tam üç mağaza seçeneği üç mağaza olarak kaydedilir. Kargo eşiği nedeniyle seçilen farklı teklifin doğru fiyatı ve ürün bağlantısı gösterilir. En fazla üç mağaza planının iki mağazada optimum olması mümkündür; ekran gerçek mağaza sayısını korur.
- Canlı teklifler 20 dakika, kargo kuralları 24 saat geçerlidir. Geçici ağ hatası taze doğrulanmış fiyatın tarihini ilerletmez. Gelecekteki veya bozuk tarihler taze kabul edilmez.

## Mağazalardan tarihli fiyat kanıtı

Aşağıdaki herkese açık ürün sayfaları 1 Ekim 2026, 23:14–23:20 Türkiye saatiyle doğrudan okunmuştur. Tutarlar test kanıtıdır; uygulamada sabit fiyat olarak kullanılmaz.

| Mağaza | Aynı 40 pin, 20 cm erkek–erkek jumper setinin KDV dahil fiyatı |
|---|---:|
| [Direnc](https://www.direnc.net/40-adet-erkek-erkek-jumper-20cm) | 49,40 TL |
| [Robotistan](https://www.robotistan.com/40-pin-ayrilabilen-erkek-erkek-m-m-jumper-kablo-200-mm) | 57,34 TL |
| [Robo90](https://www.robo90.com/40li-ayrilabilen-erkek-erkek-jumper-kablo-20cm-arduino-uyumlu) | 41,16 TL |
| [Robolink](https://www.robolinkmarket.com/40-pin-ayrilabilen-erkek-erkek-jumper-kablo-200mm) | 55,50 TL |
| [Motorobit](https://www.motorobit.com/40pin-20cm-erkek-erkek-jumper-kablo) | 51,00 TL |
| [Komponentci](https://www.komponentci.net/jumper-kablo-erkek-erkek-m2m-20cm-40-adet-pmu235) | 38,93 TL |
| [SAMM](https://market.samm.com/40-li-erkek-erkek-jumper-seti) | 42,66 TL |

[Robot Sepeti](https://www.robotsepeti.com/40-pin-erkek-erkek-jumper-kablo-20cm) sayfasında başlık 20 cm, açıklama 30 cm bildirdiği için 60,23 TL teklif kesin 20 cm karşılaştırmasına kabul edilmez.

[Komponentci HC-SR04](https://www.komponentci.net/hc-sr04-arduino-ultrasonik-mesafe-sensoru-pmu245) 48,44 TL, [SG90 180°](https://www.komponentci.net/sg90-rc-mini-servo-motor-micro-servo-motor-sg90-9g-180-pmu232) 72,20 TL olarak doğrulanmıştır. [10 dirençlik paket](https://www.komponentci.net/1k-1-4w-direnc-10-adet-pmu7633) 2,95 TL; [5.000 dirençlik paket](https://www.komponentci.net/1k-1-4w-direnc-5000-adet-pmu12) 696,58 TL'dir. Paketlerin minimumu ve sipariş adımı parça adedine çevrilir.

[Özdisan TEXAS NE555P DIP8](https://www.ozdisan.com/p/programlanabilir-zamanlayici-ve-osilator-entegreleri-211/texas-ne555p-14278): 1 adet 14,96 TL; 25 adet 346,51 TL; 50 adet 637,58 TL; 250 adet 3.184,86 TL. MOQ 1, MPQ 50, adım 1. [AMS AMS1117-3.3 SOT223-4](https://www.ozdisan.com/p/lineer-voltaj-regulatorleri-279/ams-ams1117-3-3-348307): 1 adet 8,76 TL; 100 adet 820,03 TL; 500 adet 3.817,39 TL; 1.000 adet 7.069,25 TL. MOQ 1, MPQ 2.500, adım 1. Alternatif reel hazırlama ücretli teklif varsayılan kesilmiş bant teklifiyle karıştırılmaz.

## Kabul kontrolleri

- 97 otomatik test, TypeScript kontrolü ve üretim derlemesi geçti. Gerçek sayfalardan kişisel veri içermeyen 15 örnek parça `tests/fixtures/merchants/` içindedir. Ağ gerektirmeyen testler fiyat, KDV, minimum/adım, yanlış varyant, açıklama çelişkisi ve miktar indirimi regresyonlarını kapsar.
- Yerel API kontrolünde sepet düzenleme, optimizasyon, tam mağaza sayısıyla plan kaydı, üç ayrı oturumla paylaşım/yetki, BOM ve birleştirme akışları geçti.
- Canlı API kontrolü 128 kayıtlı canlı teklif üzerinde geçti; minimum/adım ve demo/canlı ayrımı doğrulandı. Bu kayıtlardan doğrulanmayan veya süresi dolanlar hesaplamaya katılmaz. Arama ekranında aynı jumper setinin mağazaya özel fiyatları görüldü; SAMM 42,66 TL uygulama API'sinden doğrulandı. Komponentci okuyucusu gerçek sayfayı 38,93 TL ile doğruladı, ancak yerel Cloudflare ortamının robots isteği erişim hatası verdi; bu ortamda fiyat kabul edilmedi.
- Sekiz kalemli gerçek fiyat sepetinde 63.504 olası mağaza dağılımı bağımsız olarak hesaplandı. Motor aynı sonucu verdi: en fazla iki mağaza 2.063,92 TL; tam üç mağaza 2.104,04 TL. Mağaza başına bilinmeyen kargo varsayımı 80 TL idi. Tarihli ayrıntılı sonuç çalışma alanındaki `outputs/genel-eslestirme-kontrol.json` dosyasında bulunur.
- Bağımsız veri sorgusu kontrolü yalnızca bellekteki SQLite üzerinde 2.637 teklif, 130 ürün ve tek ürünün 1.207 teklifiyle yapıldı. 2.507 ilgili canlı teklif eksiksiz döndü. Küsuratlı fiyat hesabı 512 bağımsız BigInt karşılaştırmasıyla doğrulandı.

## Açık sınırlar

Site haritasındaki 1.045.441 adres doğrulanmış fiyat sayısı değildir. Giriş gerektiren, erişimi engellenen, belirsiz veya tutarsız ürün sayfaları açık nedenle dışlanır. Her mağazanın tüm kataloğu için kesintisiz okuma iddiası yoktur. Satıcı sayfaları, stok ve fiyatlar değişebilir.

Teslimat sayfasında doğrulanmayan taşıma bedeli tahmin olarak işaretlenir ve kullanıcı tarafından değiştirilebilir. Gerçek ödeme toplamı adres/desi, kupon veya satıcının sepet kurallarına bağlı olabilir. Google/Supabase harici kimlik bilgileri bu çalışma alanında bulunmadığından o bağlantılar için canlı kabul testi yapılmamıştır.

Yayın aynı proje ve mevcut erişim ayarıyla yapılır: https://en-ucuzu-burada.furkanyurtsev6.chatgpt.site
