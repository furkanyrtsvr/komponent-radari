# Geliştirme ve bakım araçları

Komutları depo kökünden çalıştırın. Günlük geliştirme için `npm run dev`, `npm test`, `npm run typecheck` ve `npm run build` yeterlidir.

| Konum | Amaç |
| --- | --- |
| Bu klasördeki `install-*`, `npm-install`, `run-framework`, `sites-env`, `execution-profile` | Kurulum ve platforma uygun çalıştırma |
| `catalog/build-catalog-matches.mjs` | Derlemede kullanılan eşleştirme dizinini oluşturma |
| `catalog/build-merchant-index.mjs`, `catalog/update-merchant-index.mjs` | Mağaza adres dizinini hazırlama |
| `catalog/catalogue-b.ts`, `catalog/run-catalogue-b.ps1` | B fiyat arşivini toplama |
| `catalog/export-catalogue-b.mjs`, `catalog/stream-catalogue-xlsx.py` | Kategori bazında Excel dışa aktarımı |
| `catalog/audit-merchant-products.ts` | Mağaza okuyucularının elle başlatılan ağ denetimi |
| `db/generate-postgres.mjs` | SQLite şemasından alternatif PostgreSQL geçişi üretme |
| `sites/` | Sites Vite eklentisi ve lisans bildirimi |

Toplayıcı ve ağ denetimleri için [B arşivi rehberini](../docs/B_FIYAT_ARSIVI.md) okuyun. `work/`, `outputs/` ve çalışma veritabanları yereldir; Git'e eklenmez.
