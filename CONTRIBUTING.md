# Katkı rehberi

Önce [kurulum](docs/KURULUM.md) ve [mimari](docs/MIMARI.md) belgelerini okuyun. Değişikliği ayrı dalda ve incelenebilir bir pull request ile sunun.

```sh
npm test
npm run typecheck
npm run build
```

Değiştirdiğiniz alanda anlamlı regresyon ekleyin. Eşleştirmede hem aynı ürünün farklı yazımı hem benzer isimli yanlış varyant sınanmalıdır. Okuyucuda ana ürün/fiyat/stoğun kendi sayfasına ait olduğunu doğrulayın.

Ağ kullanan `tests/shopping-api.mjs`, `tests/link-live-smoke.mjs` ve benzer senaryolar ayrı yerel sunucu ister; test sepeti oluşturabilir. Destekleyen testlerde `TEST_BASE_URL` kullanın. Üretim kullanıcılarının sepetlerini deneme için değiştirmeyin. Eski demo testleri geçici test bayrağı ister.

Fiyat üretmeyin; başarısız okumada tarihi ilerletmeyin. Stok dışı, bilinmeyen stok ve erişim hatasını ayırın. Görsel benzerliği teknik farkın yerine geçmez. CAPTCHA/giriş atlatma veya sınırsız paralel tarama eklemeyin; bekleme aralıklarını koruyun.

Yeni mağaza mevcut 14 mağazanın dışındaysa sahibiyle kapsamı netleştirin. KDV, paket, fiyat ve stok ayrı doğrulanır. Pull request’te problemi, sonucu, kontrolleri ve sınırları açıklayın. Sırları/kullanıcı verilerini commit etmeyin.
