# İsim/model bazında teklif gösterimi — 3 Ekim 2026

Kullanıcı isteği: yalnızca birebir eşleşmelerle sınırlama; benzer isim veya aynı model koduyla bulunan fiyatları göster, uygun olmayan mağaza teklifini × ile sepet karşılaştırmasından kalıcı olarak çıkar ve geri al.

- TP5000 eski model beyaz listesinde yoktu. Yeni genel model ve isim anahtarları TP5000, XL4015, MAX98357 gibi kodları da keşfeder. Canonical kimlik kuralları değişmedi.
- Birebir olmayan tekliflerde mağazanın gerçek başlığı ve “İsim/model benzerliği” etiketi görünür. Her fiyat kendi ürün sayfasından okunur; başka mağazanın fiyatı kopyalanmaz.
- İsim benzerliği ile ilişkilendirme yalnızca sepet hesaplamasında uygulanır. 1A ve 2A ürün kayıtları birleştirilmez. Açıkça başka türü anlatan test-point başlığı şarj modülü sayılmaz.
- Link sonuçları ve ürün detayındaki × aynı sepet/ürün/gerçek teklif kararını kaydeder. Çıkarılan teklif optimizasyona katılmaz. Geri al ile tekrar kullanılabilir. Başka sepet etkilenmez; ortak sepet katılımcıları aynı kararı görür. Yalnızca sahibi ve editörler değiştirir.
- Model bazında farklı ihtiyaç satırlarında aynı fiziksel mağaza stoğu iki kez harcanamaz.
- Link ekranında ürün tutarı gösterilir, kargo gösterilmez. Kargo dahil sepet hesabı korunur.

Doğrulama: 118 birim kontrolü, TypeScript kontrolü; gerçek Robiz/Motorobit fiyatlarıyla yerel uçtan uca çıkarma, optimizasyondan düşme, kalıcılık, geri alma ve ortak sepet yetkileri. Komponentci TP5000 sayfasından 57,35 TL fiyat bağımsız mağaza okuyucusunda ve yayındaki önceki sürümde doğrulandı. Son yayında `tests/name-link-smoke.mjs` aynı Komponentci bağlantısını kontrol eder.

Bu belge önceki LM2596 belgesindeki “farklı sürüm teklif listesine giremez” davranışını günceller: sürümler ayrı canonical kayıtlarda kalır, isim etiketiyle aynı ihtiyacın karşılaştırmasında görünür ve kullanıcı tarafından çıkarılabilir.
