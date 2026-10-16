# Kaynak teslimi · 4 Ekim 2026

Son davranış değişikliği Sites sürüm 38’e yayımlandı. Kaynak referansı `d1f9aa1a1b72de22a3b5a16e1cc48b4d5097901c`. GitHub paketi buna güncel paylaşım/kurulum belgelerini ve boş barındırma kimliğini ekler.

## Genel eşleştirme

- Kısaltılmış/bozuk yazılmış isimler yalnız potansiyometre için değil, kendi açıklaması ve teknik tablosuyla ortak katmanda değerlendirilir.
- Her teklif kendi mağaza bilgisini kullanır; başka mağazanın açıklaması yerine geçmez.
- Model/sayılar korunur. Entegre–modül, geliştirme kartı–röle/sürücü/şarj kartı ve pin/kanal farkları ayrılır.
- Eski yanlış ilişkiler yeniden kontrol edilir. Eksik açıklama doğrulanmış açıklama diye gösterilmez.
- Delil işlemleri sınırlı önbellekte paylaşılır; uzun açıklamalar teklif kopyalarıyla tarayıcıya taşınmaz.

## Doğrulama

175 otomatik test, tür kontrolü ve üretim derlemesi geçti. Açıklama senaryoları 16 ürün türünde kontrollü testlerle sınandı. Önceki gerçek sayfalardan 2.225 gözlemle yeniden yapılan kontrol geçti; 4.252 farklı aday ilişkisi hesap dışında kaldı. Bu yeniden değerlendirme bütün sayfaların teslim tarihinde canlı okunduğu anlamına gelmez.

3 Ekim’de 13 kategoriden 13 sayfa ve dokuz mağazadan 1K örneği ayrıca canlı okundu. Fiyatlar değişebilir. Bütün bir milyon ürünün anlık doğrulandığı iddia edilmez. [Ayrıntılı rapor](archive/VERIFICATION_2026-10-03_DESCRIPTION_EVIDENCE.md).

Önceki `VERIFICATION_*.md` kendi tarihleriyle korunur. Yeni README, kurulum/mimari/B/GitHub rehberleri, katkı ve güvenlik belgeleri eklendi. Kurulum altı D1 geçişini içerir; kullanıcı verisi pakete girmez.
