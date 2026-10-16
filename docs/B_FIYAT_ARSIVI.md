# B fiyat arşivi ve kategori Excel’i

B fiyat arşivi karşılaştırmayı hızlandırır. Excel okunabilir çıktıdır; uygulama her aramada milyon satırlık Excel açmaz.

`scripts/catalogue-b.ts` mevcut 14 mağazanın adreslerini `work/catalogue-b/catalogue.sqlite` kuyruğuna alır. Mağaza içinde sıralı istek, robots.txt ve Crawl-delay korunur; Robotzade/Robitshop beklemesi 30 saniyedir.

Windows:

```powershell
./scripts/run-catalogue-b.ps1 -Limit 250 -KnownOnly
```

Başka kurulumda, aktarım anahtarını güvenli süreç ortamına tanımlayıp kendi site adresinizi verin:

```sh
node node_modules/tsx/dist/cli.mjs scripts/catalogue-b.ts --collect --limit=250 --known-only --site=https://KENDI-UYGULAMANIZ
```

Windows sarmalayıcısı mevcut uygulamanın varsayılan adresini kullanır. `--known-only`, önce gerçek fiyatı okunmuş veya sepet için önceliklendirilmiş kayıtlara gider; mağaza başına 250 sınırı, son deneme ve sonraki kontrol zamanı korunur. Tek toplayıcı kilidi vardır. Tüm bir milyon adresin günde iki kez sayfa sayfa yenilenmesi vaat edilmez.

## Aktarım

Sunucu ve toplayıcı aynı `CATALOG_INGEST_SECRET` değerini kendi güvenli ortamında kullanmalıdır. Sırları tarayıcıya, Git’e veya loga yazmayın. Windows sarmalayıcısı mevcut kullanıcıya ait DPAPI korumalı `work/catalogue-b/ingest-secret.dpapi` okuyabilir; bu dosya başka bilgisayara taşınmaz.

`/api/catalog-snapshot` mağaza, HTTPS URL, kontrol zamanı, TRY/KDV, fiyat ve satış birimini doğrular. Eski aktarım yeni gözlemin üzerine yazılmaz. Başarısız aktarım tekrar denenecek kayıtları silmez. Başarısız yeni okumada eski fiyatın tarihi ilerlemez; hata ve son deneme ayrı tutulur.

Harici XML/CSV beslemesi ancak alan/KDV/paket doğrulandıktan sonra `lib/catalog-snapshot.ts` şemasına çevrilir; doğrulanmamış fiyat üretilmez.

## Excel

Toplama ve aktarım bitip yayından geri okuma doğrulandıktan sonra:

```sh
node scripts/export-catalogue-b.mjs
```

Bu isteğe bağlı araç, normal `npm ci` ile gelmeyen Codex çalışma alanının `@oai/artifact-tool` ve Python runtime’ını kullanır. Runtime kökü `CODEX_DEPENDENCIES` ile belirlenebilir; `work/catalogue-b/node_modules` bağlantısı runtime Node paketlerini göstermelidir. Bu ortam yoksa web uygulaması ve toplayıcı çalışabilir; mevcut Excel aracı ek kurulum olmadan çalışmaz.

Çıktı `outputs/catalogue-b/KOMPONENT_RADARI_B_KATEGORI_KATALOGU.xlsx`: 13 kategori + Özet, sayısal TL fiyatları, UTC kontrol tarihleri, stok, paket/adım, URL ve hata alanları. Okunmamış fiyat boş, eski kayıt ayrı belirtilir. Artifact Tool stil/önizlemesini oluşturur; büyük veri gövdeleri SQLite’dan standart OOXML ile akış halinde atomik yazılır.

## Zamanlama ve geri dönüş

Mevcut bilgisayardaki Codex görevi Türkiye saatiyle 08:00 ve 20:00 için ayarlıdır; ZIP başka bilgisayara bu görevi kurmaz. Ayrı makinenin anahtarı, ağı ve zamanlayıcısı ayrıca gerekir. Makine kapalıyken yerel toplama çalışmaz.

A varsayılandır; arayüzden A/B değişir. Asıl çalışma alanında `a-asamasi-2026-10-03` etiketi ve ayrı A ZIP’i korunur. Git geçmişi bu paylaşım paketinde yoktur; yeni depoda bu etiket varmış gibi kullanmayın. Tarihli ayrıntılar: [VERIFICATION_B_ASAMASI.md](../VERIFICATION_B_ASAMASI.md).
