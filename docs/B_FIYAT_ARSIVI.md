# B hızlı fiyat arşivi

B modunda **Ürün keşfet**, doğrulanmış eski fiyatları da özgün kontrol tarihi ve “Eski fiyat” etiketiyle gösterir. 12 saatlik sınır güncellik sınırıdır; eski fiyat veya stok sepette güncel teklif kabul edilmez. Vergisi, satış birimi veya ürün kimliği doğrulanmamış bir kayıt fiyat olarak gösterilmez. “Arşivi yeniden oku” yalnız veritabanını tekrar okur; kontrol tarihini değiştirmez.

Varsayılan “Fiyatı ve görseli olanlar” görünümü, ortak arşivde doğrulanmış fiyatı ve mağazanın ürün görseli bulunan kayıtları gösterir. Ürünler gerçek ürün kimliğiyle gruplanır; arama, kategori, mağaza ve sayfalama bu arşiv üzerinde çalışır. Sunucudaki salt okunur dizin en fazla bir dakika önbelleklenir. “Tüm katalog · eksikler dahil” görünümü, henüz taranmamış adresleri de içerir ve fiyatları 120 bağlantıya kadar toplu sorgularla okur. İki görünüm de canlı mağaza isteği başlatmaz. Eksik fiyat veya görsel için benzer ürünün verisi kullanılmaz.

Bu kural Ürün keşfet fiyat önizlemelerine aittir. Bağlantıdan karşılaştırma ve sepete ekleme işlemleri gerektiğinde ayrı ürün doğrulama akışını çalıştırabilir. Otomatik toplayıcı arşivi arka planda güncellemeye devam eder.

## Veriler nerede tutuluyor?

Yayımlanan sitenin B arşivi ortak sunucu veritabanındadır; ziyaretçilerin bilgisayarlarında ayrı arşivler oluşturulup sonradan birleştirilmez. Sunucunun mağaza okuyucusuyla doğruladığı kullanıcı sorguları ve GitHub toplayıcısının doğrulanmış gözlemleri aynı `catalog_snapshots` tablosuna yazılır. Daha yeni gözlem korunur; geç gelen eski kayıt fiyatı veya kontrol tarihini değiştiremez.

Tarayıcı kendi başına bütün mağazaları taramaz. Otomatik GitHub görevi site kapalıyken de çalışabilir; görev zamanlaması tam başlama saati garantisi değildir. A/B seçimi tarayıcıya aittir, fiyat arşivi ortaktır. Ortak arşiv kullanmak kişisel sepetleri birleştirmez. Toplayıcının yerel SQLite dosyası GitHub görevinin çalışma kuyruğudur; ziyaretçinin bilgisayarında kurulmuş bir görev değildir. Dışarıdan arşive veri göndermek için toplayıcı sırrı gerekir; ziyaretçinin bildirdiği ham fiyat doğrudan güvenilir fiyat kabul edilmez.

## Otomatik toplama

GitHub `Collect merchant price archive` iş akışı her saatin 13. ve 43. dakikasında çalışır. SQLite kuyruğu Actions önbelleğinde saklanır; sonraki çalışma kaldığı yerden devam eder. Varsayılan tur mağaza başına en fazla 40 sayfadır. Fiyatlar 8 saatten sonra yenilemeye aday olur; en eski doğrulama önce gelir. Henüz güncel olan izleme kayıtları her saat yeniden öne alınmaz. Açık yenileme isteklerine en fazla dörtte bir, yeni adreslere en az beşte bir kapasite ayrılır; boş kapasite diğer sınıflara geçer. İzleme önceliği tarihsel ürün ithalatlarından değil canlı sepet, favori ve etkin takiplerden oluşur. Başarısız okuma eski fiyatın tarihini yenilemez.

Toplama 18 dakikalık süre bütçesinden sonra yeni sayfa başlatmaz; doğrulanmış kayıtların aktarımı için zaman bırakır. Normal kapanışta SQLite WAL ana dosyaya yazılır. Kapasite, robots.txt bekleme aralıklarına ve erişilebilirliğe bağlıdır; her ürünün sekiz saatte bir kesin yenileneceği iddia edilmez.

Bu bir tam katalog anlık fiyat garantisi değildir. Bir milyondan fazla adresin ilk taraması çok sayıda tur gerektirir. Mağazaların robots.txt kuralları, istek aralıkları ve erişim engelleri korunur. 20 mağazanın okuyucuları ve ürün adres dizinleri bağlıdır. Pil Sitesi dizini, engellenen XML site haritası nedeniyle herkese açık kategori sayfalarından kısmi olarak keşfedilir. Ürün dizininde bulunmak fiyatının doğrulandığı anlamına gelmez; teklif talebi isteyen veya verileri çelişen sayfalarda fiyat boş kalır.

Sunucunun ve GitHub deposunun `CATALOG_INGEST_SECRET` sırları aynı olmalıdır. Gerçek değerler kaynak koduna veya iş akışı dosyasına yazılmaz. Şablon: `scripts/catalog/catalog-archive.yml`; etkin GitHub kopyası `.github/workflows/catalog-archive.yml` konumundadır. Otomatik fiyat güncellemeleri siteyi yeniden yayımlamaz.

Arşiv kapsamı ve mağaza durumu uygulamadaki fiyat kaynağı bölümünde görünür: toplam/güncel kayıtlar, son toplama, mağaza bazında kapsam ve erişim hataları.

## Yerel çalıştırma

Depo kökünden:

```powershell
./scripts/catalog/run-catalogue-b.ps1 -Limit 20
```

`-KnownOnly` yalnız daha önce fiyatı okunmuş veya sepet bağlantısı olan kayıtları yeniler; bütün kataloğu keşfetmek için kullanılmaz. Tek toplayıcı kilidi ve başarısız okumalarda yeniden deneme zamanı vardır.

## Excel

`node scripts/catalog/export-catalogue-b.mjs`, yerel kuyruğu kategori bazında Excel dosyasına aktarır: `outputs/catalogue-b/KOMPONENT_RADARI_B_KATEGORI_KATALOGU.xlsx`. Excel uygulamanın çevrimiçi arama veritabanı değildir. `work/`, yerel veritabanları ve sırlar Git'e eklenmez.

[Mağaza ve stabilite denetimi](STABILITE_2026-10-20.md)
