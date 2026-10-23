# Model araması ve kategori sayfalaması

Komponentci'nin `stm32f103c6t6a-gelistirme-karti-pmu61492` ürünü katalogda ve Geliştirme Kartları kategorisindeydi. Hata katalog eksikliğinden değil, rakam içeren bütün arama sözcüklerinin tam eşitlikle aranmasından kaynaklanıyordu. `STM32` uzun model kodunu bulamıyordu.

Harfle başlayan, en az iki harflik ön eki olan model kodlarında arama öneki kabul edilir. `STM32`, `STM32F103C6T6A`; `ESP32`, `ESP32S3` sonuçlarını bulabilir. `12V`, `120V`; `10ohm`, `100ohm`; `M3`, `M30` eşleşmez. Bu kural yalnız keşif içindir. Ürün kimliği, teknik eşleştirme ve fiyat doğrulama kuralları değiştirilmedi: C6T6 ve C6T6A ayrı kayıtlardır.

Çok mağazalı kategori gezintisindeki sayfaya bağlı mağaza kotası önceki sayfaların sırasını değiştiriyordu. Mağaza listeleri artık sabit dönüşümlü sırayla birleştirilir, ürün kimliği tekrarları kaldırılır ve sonra sayfalanır. Sayfa büyüdükçe önceki sayfaların sırası kaymaz. Tek sorguda her mağazadan en az istenen sayfayı dolduracak sayıda benzersiz kimlik alınır; kaynaklar mevcut mağaza eşleşme dizininden korunur.

Gerçek katalog kontrolü: Geliştirme Kartları'nın ilk dört sayfası 40'ar kayıt, toplam 160 benzersiz ürün, sayfalar arasında sıfır tekrar. Aynı kategoride `stm32` sorgusu verilen Komponentci bağlantısını buldu. Eşleştirme kurallarının bütün mağaza adlandırmalarında kusursuz olduğu iddia edilmez; yeni toplu bildirim raporu farklı örnekleri birlikte değerlendirmek içindir.
