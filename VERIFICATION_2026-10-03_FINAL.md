# Son fiyat ve sepet doğrulaması · 3 Ekim 2026

Temel tasarım ve A yedeği korundu. Son alınan gerçek fiyat, kontrol tarihiyle gösterilir. A 20 dakikalık, B 12 saatlik güncel arşivi önce kullanır; süre sonunda canlı okuma denenir. Okuma başarısız olduğunda önceki doğrulanmış kayıt tarih değiştirilmeden kullanılabilir. LM2596S/LM2596T gibi model son eki farklı bare entegreler de modülün fiyatı sayılmaz. Gerçek farklı model, voltaj, akım, kamera, kablo türü, stok yokluğu ve yetersiz satış paketi otomatik satın alma hesabına karışmaz.

Sepet hesabı kullanılabilir fiyatlar varsa bütün mağazaların yanıtını beklemez. Yalnız fiyatı olmayan ürünler hesap öncesinde yenilenir; çalışma alanının bağımsız yenilemesi devam eder. Ürünleri tek tek en ucuzundan almak için gereken farklı mağaza sayısı gösterilir. Aynı toplamı veren mağaza sınırları bir karta iner; daha düşük toplam getiren ek mağaza ayrı kalır. Tam mağaza sayısı ve üst sınır sonuçlarının tam verisi API'de korunur. Arama süresi sınırında matematiksel minimum kanıtlanmamışsa bu durum açıkça belirtilir.

## Gerçek kaynak denemesi

- 14 mağaza, 13 kategori, 2.520 farklı mağaza bağlantısı.
- 2.225 gerçek fiyat/stok/satış birimi kaydı; 1.859 model/kimlik grubu.
- 2.225 sepet/eşleştirme/ürün + kargo hesap kontrolü geçti.
- 1.023 mağaza ürününde başka mağazadan karşılaştırılabilir kayıt bulundu. Bilinen 1.152 farklı varyant aday ilişkisi hesap dışına alındı.
- Yayındaki B önizlemesinde 2.225 / 2.225 fiyat, stok ve paket sonucu native mağaza gözlemiyle aynı.
- A ve B canlı örneklerinde AMS1117 3.3V, TP5000 2A ve TP5000 1A okundu; farklı akım ayrı tutuldu. Robitshop 545 stok adedi minimum satın alma adedi sayılmıyor: LM2577/LM2596 ürünü 1 adet 144,45 TL olarak doğrulandı.
- Teklif çıkarma, kalıcı seçim, geri alma, ortak sepette görünmesi ve görüntüleyici düzenleme yasağı yayında geçti.
- 151 otomatik kontrol, tür kontrolü ve üretim derlemesi geçti.
- 295 bağlantı doğrulanamadı; kayıtlar ve nedenleri ayrı tutuldu. Bunlar stokta yok varsayılmadı ve sahte fiyatla tamamlanmadı.

Ham sonuçlar ve rapor `outputs/product-audit-final/` altında. Gerçek sayfa kanıtları yerel `work/product-audit`, `work/product-audit-1500`, `work/product-audit-topup` klasörlerinde. Bu klasörler sırlar içeren toplayıcı çalışma alanıyla birlikte Git/yayın paketine girmez.

## Arşiv ve geri dönüş

Kategori Excel'i `outputs/catalogue-b/EN_UCUZU_BURADA_B_KATEGORI_KATALOGU.xlsx`: 1.058.051 adres, 13 kategori + Özet. Sadece okunmuş fiyatlar doludur; kontrol tarihleri ayrı sütundadır. Yerel zamanlı görev 08.00 ve 20.00 İstanbul saatinde `scripts/run-catalogue-b.ps1 -Limit 250 -KnownOnly` ile sepet ve daha önce fiyatı doğrulanan ürünlere öncelik verir. Bilgisayar ve Codex açık olmalıdır. Tek mağazaya aynı anda bir istek, robots bekleme süresi korunur. Başarısız aktarım idempotent olarak yeniden denenir; yeni fiyatın üzerine eski gözlem yazılmaz. Aktarım D1'de atomik gruplarla yapılır.

A kaynağı: `a-asamasi-2026-10-03` etiketi ve `outputs/EN_UCUZU_BURADA_A_ASAMASI_2026-10-03.zip`. Fiyat kaynağı seçicisinden A/B arasında dönülür. Kullanıcı sepetinin adetleri veya ürünleri bu son UI kontrolünde değiştirilmedi.
