# Kısaltmalar ve açıklama teyidi — 3 Ekim 2026

Sorun: `https://www.direnc.net/1k-potans` bağlantısının gerçek ürün adı “1K Potans”, açıklamadaki adı “1K Potansiyomtre”. Önceki isim keşfi tek ortak kelimeyi reddediyor, diğer mağazaların “Potansiyometre” adlarıyla ortak anahtar üretmiyordu.

Kısaltma/yazım varyantları bütün direnç değerlerinde ortaklaştırılır. 1K, 1K0, 1 kΩ ve 1000 Ohm aynı değerdir. Gerçek mağaza adı korunur. Kendi ürün açıklamasının girişindeki ad, başlığın model/değeriyle teyit edilirse ürün türünü tamamlar. Tavsiye listeleri ve açıklamada geçen başka bileşenler kimliği değiştirmez.

Trimpot, sabit direnç, potansiyometre düğmesi, dijital/sürgülü/çok turlu ürünler, modüller ve yüksek güçlü reostalar normal milli potansiyometreden ayrılır. Belirtilen anahtar, bacak sayısı, logaritmik/lineer karakter, ölçü ve model farklılıkları korunur. Başlık ile açıklama/teknik direnç değeri çelişirse fiyat kullanılmaz. Adında yalnızca “ayarlı direnç” bulunan kayıt açıklaması okununcaya kadar keşif ipucudur.

Sepet karşılaştırmasında her teklifin kendi mağaza kaydındaki açıklama kullanılır. Daha önce birleştirilen başka bir mağazanın açıklaması teklifin üzerine kopyalanmaz. Asıl kaynak yeniden okunduğunda eşleşen mevcut ürünün açıklaması da güncellenir.

## Gerçek mağaza okumaları

`outputs/matching-abbreviations/live-feed.ndjson`: bağımsız mağaza okuyucularıyla okunan ve fiyat/KDV/satış birimi doğrulanan dokuz kayıt. Gerçek gözlem tarihleri korunarak B arşivine aktarılır.

| Mağaza | Sayfadaki ürün adı | KDV dahil ürün fiyatı |
|---|---|---:|
| Direnç.net | 1K Potans | 6,97 TL |
| Motorobit | 1K Potansiyometre | 7,80 TL |
| Komponentci | 1K Potansiyometre WH148 | 8,02 TL |
| Robo90 | 1K Potansiyometre - WH148 | 8,82 TL |
| Robotronik | 1K Potansiyometre | 8,83 TL |
| Robolink Market | 1K Potansiyometre | 10,50 TL |
| Robocombo | 1K Potansiyometre | 10,67 TL |
| Robot Sepeti | 1K Potansiyometre | 10,85 TL |
| Robotistan | 1K Potansiyometre - WH148 | 12,31 TL |

Hepsi bu okumada stokta. Bu tablo sabit bir gözlem kaydıdır; sonraki fiyatlar değişebilir. Link karşılaştırmasında yalnızca ürün tutarı, sepet optimizasyonunda kargo dahil toplam kullanılır.

## Kontroller

`tests/abbreviated-products.test.ts` farklı değerlerde kısaltma ve yazım hatalarını, eşdeğer birimleri, yanlış ürün türlerini, mekanik varyantları, açıklama girişini, açıklama çelişkilerini, sepet fiyatı ve gerçek mağaza keşfini kapsar. Önceki CH340/LM2596/XR2206/TP5000 korumaları mevcut testlerde korunur.

Canlı A/B bağlantı sonuçları yayın sonrası `outputs/matching-abbreviations/production-smoke.json` dosyasına kaydedilir. A aşaması geri dönüş etiketi korunur.
