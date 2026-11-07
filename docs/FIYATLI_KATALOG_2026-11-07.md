# Görselden bağımsız fiyat kataloğu — 7 Kasım 2026

Fiyatı doğrulanmış teklifler, görsel indirme başarısını beklemeden hazır B kataloğuna alınır. Görseli eksik ürünün fotoğrafı boş kalır ve bu durum açıkça belirtilir; başka ürünün fotoğrafı eklenmez. Fiyat, KDV, paket/satış adımı ve gerçek kontrol tarihi aynı kurallarla doğrulanır. Eski fiyat eski olarak gösterilir; güncel teklif veya stok sayılmaz. Özdisan toplu yayına dahil edilmez; link desteği korunur.

Tam fiyat kayıtları R2 üzerindeki doğrulanmış kaynak parçalarında tutulur. Bunlar tekrar D1 fiyat kopyalarına dönüştürülmez. Yayıncının yerel geçici SQLite tablosu katalog gruplamasını yapar; kalıcı küçük fiyat görünümleri yalnız fiyat veya görsel eşlemesi değiştiğinde yenilenir. Önceki yayımlanmış fiyatlar ve ana gözlemler silinmez.

Tarayıcıdaki içerik özetiyle adreslenen dosyaların reddedilmesi düzeltildi. Arama dosyaları en fazla 5 MB açılmış boyut / 4.000 ürün olacak şekilde birleştirilir, SHA-256 kontrolünden geçer ve dört eşzamanlı istekle alınır. İlk yüklemeden sonraki aramalar yerelde yapılır. Akıllı sepet ve Ürün keşfet aynı katalog akışını kullanır; ürün açmak mağaza taraması başlatmaz.

İlk geçiş yeni görsel indirmeyi beklemeden fiyatları yayımlar. Sonraki bağımsız yayın turları mevcut kalıcı görselleri tekrar kullanır ve eksikleri hazırlamaya devam eder. Bütün dosyalar doğrulanmadan etkin katalog değiştirilmez.

Yeni doğrulamalar: `tests/priced-catalog-2026-11-07.test.ts` — görselsiz fiyat, fiyat/görsel bağımsızlığı, hatalı fiyatın reddi, eski tarihin korunması, değişen kayıt önbelleği, iki arama yolu, içerik adresli tarayıcı dosyaları ve dosya boyut sınırları. Ayrı yerel D1/R2 denemesinde görselsiz fiyat yayını, B arşiv önizlemesi, metre/paket bilgisi ve önceki tekliflerin korunması denetlendi. Eski testler tekrar çalıştırılmadı.

Büyük katalogda ürün adlarının birim/model arama gösterimleri dosya okunurken bir kez hazırlanır. Voltaj, boyut ve konnektör eşleştirme kuralları değişmez. İlk doğrulanmış dosyanın sonuçları kalan dosyalar yüklenirken gösterilir; toplam eşleşme sayısı tamamlanana kadar kesin sayı verilmez.
