# GitHub’da kaynak paylaşma

Teslim GitHub’a hazır kaynak ZIP’idir; GitHub’da depo oluşturmaz veya yükleme yapmaz.

Uygulama, bağımlılık kilidi, mağaza adres dizini, testler, SQL geçişleri ve belgeler dahildir. Üçüncü taraf lisansları korunur. Paket `.openai/hosting.json` içinde boş Sites proje kimliği taşır.

Dışarıda: `.git`, `node_modules`, `dist`, `work`, `outputs`, yerel veritabanları, DPAPI, gerçek sırlar, kullanıcı sepetleri, kişisel oturumlar ve makine runtime ayarları. `tests/fixtures/merchants/` tarihli regresyon parçalarıdır; anlık fiyat değildir.

ZIP’i açın; `en-ucuzu-burada/` içeriği depo kökü olsun. GitHub’da hesabınızda boş depo oluşturun, gerçek adresinizle:

```sh
git init
git branch -M main
git add .
git status --short
git commit -m "Initial source release"
git remote add origin https://github.com/KULLANICI/en-ucuzu-burada.git
git push -u origin main
```

`KULLANICI` yer tutucudur. Dışlanan sırları zorla eklemeyin. Web arayüzüyle yüklemede gizli `.gitignore`/`.openai` dosyalarını atlamayın; çok sayıda dosya için Git daha uygundur.

Depo açıklaması: **Türkiye’de elektronik komponent fiyat karşılaştırması, açıklama destekli ürün eşleştirmesi ve kargo dahil sepet optimizasyonu.**

Konu etiketleri: `electronics`, `price-comparison`, `typescript`, `react`, `cloudflare-workers`, `shopping-cart`.

Yeni depo üretim kullanıcılarını veya fiyat arşivini devralmaz. GitHub’a kaynak yüklemek çalışan Worker/API’yi GitHub Pages üzerinde barındırmak değildir.

Proje adına açık kaynak lisansı seçilmedi; hak sahibi dağıtım koşullarını ayrıca belirleyebilir. [Lisans bildirimi](../LICENSE_NOTICE.md).
