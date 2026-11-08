# Kalıcı görsel kuyruğu — 8 Kasım 2026

Görsel hazırlığı fiyat yayınına bağlı değildir. `archive-images.yml` saatte bir 40 dakikalık çalışma başlatır. Aynı kuyruk için eşzamanlı ikinci iş açılmaz; fiyat toplayıcısı ve yayıncı ayrı devam eder.

İlk keşif, fiyat arşivini UUID dizini üzerinden sınırlı ve iki eşzamanlı sayfayla okur. Kontrol noktası her 16 sayfada, görsel işlemede en geç iki dakikada ve iş sonunda saklanır. Sonraki turlar fiyat değişiklik dizisinden yalnız yeni/değişen görsel adreslerini alır. Aynı görsel adresini kullanan ürünler tek işte birleşir. Kaynağı olmayan kayıtlar ayrı sayılır. Özdisan toplu kuyruğa alınmaz.

Kuyruk ve doğrulanmış görsel eşlemeleri R2 üzerinde saklanır. Küçük kuyruk kontrol noktasının bir önceki sürümü korunur. Veritabanı yük hatası, indirilmiş dosyayı veya ürünün fiyatını silmez; başarısız yüklemenin dosyası kuyrukta tutulur. Kaydedilmiş eşleme, fiyat değişse bile yeniden indirme başlatmaz.

Eski `json_extract` ile bütün hazırlık fiyatlarını tarayan görsel araması kaldırıldı. Bilinen eşlemeler URL dizininden yirmişerli, yeni eşlemeler onarlı işlenir. Her yeni eşleme fiyat kaynağıyla doğrulanır ve önce kalıcı dosya günlüğüne yazılır. Veritabanı dizini geçici olarak yoğun olsa bile dosya korunur ve dizin tekrar denenir. Yayıncı yeni eşlemeleri artan satır kimliğiyle alır; mağazalardan fotoğraf indirmez.

Hazır görseller fiyat yayını bitmeden `archive-image-source` üzerinden gösterilir. Bu uç yalnız kalıcı depodan okur, mağazaya gitmez ve D1 sorgusu yapmaz. Eksik dosyanın yerini başka ürün fotoğrafı almaz. Açık katalogda eksik görseller üç dakikada bir yeniden kontrol edilir; yüklenmiş fotoğraflar tekrar istenmez.

Yeni dosyalar oranı korunarak, büyütülmeden ve kırpılmadan WebP biçimine çevrilir. En büyük kenar başlangıçta 800 pikseldir; kalite/boyut kademeli ayarlanarak en fazla 120.000 bayt (0,12 MB) hedeflenir. GIF ilk karesi desteklenir. Önceden indirilmiş dosyalar yeniden dönüştürülmez veya silinmez. Mağaza bekleme ve robots kuralları korunur.

Yönetici paneli hazır/bekleyen/yeniden denenecek kaynakları, bu turdaki yeni görselleri ve son güvenli kayıt zamanını gösterir. Yeni kontroller yalnız `tests/image-queue-2026-11-08.test.ts` içindedir; eski test takımları tekrar çalıştırılmaz.
