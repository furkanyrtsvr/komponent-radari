# 3 Ekim 2026 — LM2596 bağlantı düzeltmesi

Kullanıcı örneği: `https://www.direnc.net/lm2596-power-suplay-modul-1`, karşılaştırılan Robotistan bağlantısı `https://www.robotistan.com/mini-ayarlanabilir-3a-voltaj-regulator-karti-lm2596-adj`.

Gerçek sayfa okuyucusu Direnç.net fiyatını KDV dahil 55,21 TL ve stok dışı, Robotistan Mini fiyatını KDV dahil 68,12 TL ve stokta olarak okudu. İki teknik sayfada kart ölçüleri farklı: Direnç.net 48×23×14 mm; Robotistan Mini 43×21,5×13,5 mm. Bunlar test anına ait değerlerdir.

Sorun: başlığa eklenen farklı sayıda gerilim/akım bilgisinin aynı ayarlanabilir kart ailesini ayırması ve mağaza başına dört aday sınırının sabit 5V, ekranlı ve kablolu sürümlerde dolması. Robotistan Mini adresine hiç ulaşılmıyordu. Eski genel hata metni stok dışı teklifle doğrulanamayan teklifi ayırmıyordu.

Düzeltme:

- LM2596 modül keşfinde ayarlanabilir/sabit, Mini/standart, ekran, kablo, klemens, çoklu çıkış, USB ve farklı akım sınıfı ayrılır. İki entegreli LM2596/LM2577 kartı ve çıplak IC aynı kart sayılmaz. Üretim denemesinde bulunan çok çıkışlı Komponentci adresi de standart karşılaştırmadan dışlanır.
- Aynı standart ayarlanabilir kartta ek başlık bilgisi tek başına eşleşmeyi bozmaz. Farklı kart sürümü ayrı kanonik üründe ve ayrı karşılaştırma bölümünde kalır. Kullanıcı isterse ayrı sepete ekler; otomatik ürün ikamesi yapılmaz.
- Stok dışı doğrulanmış teklifler fiyat ve mağaza bağlantısıyla açıkça gösterilir; boş karşılaştırma tablosu gizlenir.
- Yeni bulunan Mini sürüm kaydedilir. Önbellek kullanıldığında da bu sürüm görünür.
- Gerçek ana ürün bölümleri ve JSON-LD içeren iki kayıtlı HTML fixture eklendi. Fiyatlar kodda sabitlenmedi.

Doğrulama: 114 birim/regresyon testi; TypeScript; 32 alışveriş API kontrolü. Yeni `regulator-link-smoke.mjs` iki gerçek bağlantı, farklı ürün kimlikleri, stok dışı ana teklif, stokta Robotistan Mini, otomatik alternatif eklenmemesi ve önbellekte alternatifin görünmesini kontrol eder. Yerelde üç bağlantı isteğinin tamamı toplam yaklaşık 13 saniyede geçti. Eski sürümde yanlış ürün altında kalmış güncel teklifler de açılış, URL karşılaştırması ve sepet hesabında yeniden kimlik kontrolüne alınır; yeni ağ kontrolü bitmeden yanlış kartın fiyatı gösterilmez.

Üretimde gerçek stok ve fiyat tekrar okunur; mağaza erişim veya veri değişiklikleri sonucu değiştirebilir. Model doğrulaması fiziksel olarak bütün üreticilerin kartlarının birebir aynı olduğu iddiası değildir. Mini sürümde ölçü ve bağlantı uyumu kullanıcı seçimi için ayrıca gösterilir.
