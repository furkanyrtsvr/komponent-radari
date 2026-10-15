# Kurulum ve çalıştırma

Node.js >= 22.13.0, npm ve HTTPS erişimi gerekir. ZIP’in `en-ucuzu-burada/` klasöründe:

```sh
npm ci
npm run build
```

Derleme `dist/server/wrangler.json` oluşturur; depoda kök bir Wrangler yapılandırması yoktur. Yeni, boş yerel veritabanına aşağıdaki SQL dosyalarını sırayla ve bir kez uygulayın. Mevcut kullanıcı veritabanını sıfırlamayın.

PowerShell:

```powershell
$migrations = @(
  'drizzle/0000_remarkable_redwing.sql',
  'drizzle/0001_flashy_black_panther.sql',
  'drizzle/0002_stiff_lockheed.sql',
  'drizzle/0003_even_thanos.sql',
  'drizzle/0004_tense_pepper_potts.sql',
  'drizzle/0005_absent_meltdown.sql'
)
foreach ($migration in $migrations) {
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file $migration
  if ($LASTEXITCODE -ne 0) { throw "Geçiş başarısız: $migration" }
}
npm run dev
```

Bash:

```sh
for migration in drizzle/000[0-5]_*.sql; do
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file "$migration" || exit 1
done
npm run dev
```

Adres `http://localhost:5173`. Yerel misafir D1 akışı harici anahtar istemez. Yalnız statik dosyaları GitHub Pages’e yüklemek API ve sepetleri çalıştırmaz.

## Ortam değişkenleri

`.env.example` boş şablondur. Yerel Worker sırları `.dev.vars` içinde tutulabilir; Git’e eklenmez.

| Alan | Kullanım |
| --- | --- |
| `SUPABASE_URL` | Alternatif servis adresi |
| `SUPABASE_ANON_KEY` | Supabase Auth istemci ayarı |
| `SUPABASE_SERVICE_ROLE_KEY` | Yalnız sunucuda hizmet anahtarı |
| `ADMIN_USER_IDS` | Virgülle ayrılan uygulama kullanıcı UUID’leri |
| `CRON_SECRET` | Yetkili `/api/jobs/refresh` isteği |
| `CATALOG_INGEST_SECRET` | Ayrı B arşivi aktarım anahtarı |
| `REQUIRE_LOGIN` | `true` ise misafir erişimini kapatır |

`ENABLE_TEST_DATA=true` yalnız eski demo regresyonu içindir; üretimde kullanılmaz.

## Üyelik

Sites yayını ChatGPT girişini platformun doğrulanmış kullanıcı kimliğiyle kullanır. Yerel eklenti yalnız localhost üzerinde Seedy test hesabı sağlar; üretim kimlik doğrulaması değildir.

Supabase alternatifi için `supabase/migrations/` dosyalarını ad sırasıyla ayrı projenize uygulayın. `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` birlikte veri katmanını etkinleştirir. Auth sağlayıcıları, `SUPABASE_ANON_KEY` ve `/auth/complete` dönüş izni ayrıca ayarlanır. Harici Supabase kurulumuyla uçtan uca üretim doğrulaması bu teslimin kapsamına dahil değildir.

## Barındırma

Kaynak Cloudflare Worker/Sites için hazırlanmıştır. Dağıtım ZIP’inin `.openai/hosting.json` dosyası `d1: "DB"`, `r2: null`, `project_id: null` taşır. Yeni Sites projesinin verdiği kimliği kendi manifestinize yazın. Asıl çalışma alanındaki mevcut kimlik korunur.

Bağımsız Cloudflare yayını kendi D1 bağını, sırları ve güvenilir üyelik akışını gerektirir. GitHub’a kaynak yüklemek sunucuyu veya üretim verisini taşımaz.

| Komut | İşlev |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Karşılık dizini ve Worker derlemesi |
| `npm start` | Derlenmiş Worker’ı yerelde çalıştırma |
| `npm test` | Dış ağ gerektirmeyen otomatik testler |
| `npm run typecheck` | TypeScript kontrolü |
| `npm run lint` | ESLint |

Windows’ta npm sarmalayıcısı yol hatası verirse kurulu bağımlılıklarla `node scripts/run-framework.mjs dev`; derleme için `node scripts/build-catalog-matches.mjs` ve `node scripts/run-framework.mjs build` kullanılabilir.
