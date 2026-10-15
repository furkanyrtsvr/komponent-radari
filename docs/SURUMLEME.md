# Sürüm yayınlama

`main` dalına gönderilen değişiklikler GitHub Actions tarafından kontrol edilir. Kontroller başarılıysa otomatik bir GitHub Release yayımlanır. Pull request kontrolleri sürüm yayımlamaz.

- İlk sürüm kaynak sürümünü kullanır (package.json veya VERSION).
- Sonraki güncellemeler patch numarasını artırır. Kaynakta daha büyük minor/major belirtilmişse o sürüm kullanılır.
- Actions sürüm dosyasını ve kilit dosyasını günceller, bot commit'i ve vMAJOR.MINOR.PATCH etiketi oluşturur.
- GitHub tarafından kaynak ZIP/tar.gz bağlantıları ve otomatik değişiklik notları sunulur.
- Depo ayarlarında Actions çalışması ve GITHUB_TOKEN için contents:write izni kullanılabilir olmalıdır. Branch koruması bot push'unu engellerse yayın başarısız olur; koruma sessizce aşılmaz.
- Aynı anda gelen yeni commit önceki çalışmayı eskittiyse yalnız en güncel doğrulanmış main commit'i yayımlanır.

Günlük kullanım: kaynak değişikliklerini commit edip `git push origin main` çalıştırın. Önce `git pull --ff-only` ile otomatik sürüm commit'ini alın. Çalışma kopyasında kaydedilip GitHub'a gönderilmeyen dosyalar Actions'ı tetiklemez.

Bu akış GitHub Release üretir; çalışan web sitesine dağıtım, npm paketi veya Windows EXE üretimi yapmaz. ReTurn kontrolleri yalnız sözdizimi ve dosya yapısı doğrulamasıdır; donanım ve API kabul testi değildir.

GitHub CLI yayın seçeneği: https://cli.github.com/manual/gh_release_create
