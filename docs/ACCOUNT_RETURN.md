# Yeniden açılışta hesapla devam etme

Sites tarafından doğrulanan ChatGPT oturumu kimlik kaynağıdır. Başarılı girişte tarayıcıya yalnız bu giriş yönteminin tekrar kullanılacağına dair `1` işareti kaydedilir. Kimlik, e-posta, erişim anahtarı veya yetki bu işaretten üretilmez.

Site yeniden açıldığında daha önce giriş yapılmışsa önce platform oturumu kontrol edilir. Geçerliyse doğrudan çalışma alanı açılır. Geçerli değilse misafir çalışma alanı oluşturmadan önce platformun `/signin-with-chatgpt` akışına normal üst düzey gezinmeyle dönülür. Sağlayıcı oturumu devam ediyorsa hesap tekrar doğrulanır. Çerezler silinmişse veya sağlayıcı yeniden giriş istiyorsa kullanıcıdan giriş istenebilir; uygulama bunu doğrulanmış hesap gibi göstermez.

Başarısız dönüşler aynı sekmede iki dakika boyunca yeniden yönlendirilmez; böylece giriş döngüsü oluşmaz. Açık çıkış işlemi hatırlama işaretini siler ve platformun çıkış akışını kullanır. Ayrı bir kimlik sağlayıcısı veya yerel doğrulanmış hesap oturumu oluşturulmaz.

Odaklı kontrol: `node --import tsx --test tests/returning-account.test.ts`.
