# Komponent Radarı — GitHub yayını

[GitHub deposu](https://github.com/furkanyrtsvr/komponent-radari) · [Canlı uygulama](https://komponent-radari.equalwood4.chatgpt.site/)

Komponent Radarı, Türkiye’de elektronik komponent fiyat karşılaştırması, açıklama destekli ürün eşleştirmesi ve kargo dahil sepet optimizasyonu sunar. Projenin önceki adı En Ucuzu Burada idi.

## Kaynak ve kurulum

```sh
git clone https://github.com/furkanyrtsvr/komponent-radari.git
cd komponent-radari
npm run install:ci
```

Node.js 24 gerekir. Yerel veritabanı ve çalıştırma için [kurulum rehberini](KURULUM.md) izleyin.

## Güncelleme ve sürüm

Değişikliklerden önce `git pull --ff-only` çalıştırın. Güncel kaynakları aktardıktan sonra farkı inceleyin ve kontrol edin:

```sh
npm test
npm run typecheck
npm run build
git diff --check
```

Yalnız ilgili dosyaları commit edip `git push origin main` çalıştırın. GitHub Actions test, tür kontrolü ve derleme başarılı olduğunda otomatik Release oluşturur. Sites üretim yayını ayrı bir işlemdir; GitHub push’u çalışan siteyi değiştirmez.

## Paylaşım kapsamı

Kaynak kodu, bağımlılık kilidi, mağaza adres dizini, testler ve SQL geçişleri depoda yer alır. GitHub kopyasındaki `.openai/hosting.json` boş proje şablonudur; canlı Sites kimliği geliştirme kaynağında korunur.

Gerçek anahtarlar, veritabanları, kullanıcı sepetleri, oturumlar, DPAPI dosyaları, `node_modules`, derleme çıktıları ve makine ayarları depoya eklenmez. `.env.example` boş şablondur. Tarihli mağaza test parçaları anlık fiyat değildir.

GitHub kaynak yayını üretim kullanıcılarını veya fiyat arşivini taşımaz; Worker/API uygulamasını GitHub Pages’e dönüştürmez. [Lisans bildirimi](../LICENSE_NOTICE.md).
