# B hızlı fiyat arşivi

B modu, son 12 saat içinde doğrulanan fiyatları kullanır. Arşivde kayıt yoksa canlı okuma denenir; başarısızlık fiyat veya güncel tarih üretilerek kapatılmaz.

## Otomatik toplama

GitHub `Collect merchant price archive` iş akışı her saatin 13. ve 43. dakikasında çalışır. SQLite kuyruğu Actions önbelleğinde saklanır; sonraki çalışma kaldığı yerden devam eder. Her tur mağaza başına en fazla 20 sayfa okur. Bilinen fiyatların yenilenmesi ve henüz okunmamış adresler için ayrı kapasite ayrılır; yeni ürünler eski fiyat kuyruğunun arkasında süresiz kalmaz.

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
