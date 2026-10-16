"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { api } from "@/lib/client";
import { money, type Product } from "@/lib/domain";
import { toast } from "sonner";
type Review = {
  id: string;
  title: string;
  url: string;
  store_id: string;
  extracted: {
    price: number | null;
    mpn: string;
    currency: string;
    vatIncluded: boolean | null;
    packageQuantity: number | null;
    stockStatus: string;
  };
};
export function AdminTools({
  products,
  onChange,
}: {
  products: Product[];
  onChange: () => void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    void api<{ storeProducts: Review[] }>("admin/reviews")
      .then((r) => setReviews(r.storeProducts))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="admin-tools">
      <h2>Canlı teklif onayı</h2>
      <p className="muted small">
        URL analizinden gelen ham verileri, üretici, MPN, paket, KDV ve stok
        bilgisini doğrulayarak onayla. Demo çalışma alanında canlı teklif
        gösterilmez.
      </p>
      {error && <p className="error-box">{error}</p>}
      {reviews.length ? (
        reviews.map((r) => (
          <ReviewCard
            key={r.id}
            review={r}
            products={products}
            onChange={onChange}
          />
        ))
      ) : (
        <div className="info-box">
          İncelenecek URL yok. Önce “URL ile ekle” üzerinden gerçek ürün
          sayfasını analiz et.
        </div>
      )}
      <details className="surface admin-add">
        <summary>Mağaza ekle</summary>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await api("admin/store", "POST", {
                name: f.get("name"),
                domain: f.get("domain"),
                shipping_base_price: Math.round(
                  Number(f.get("shipping")) * 100,
                ),
                free_shipping_threshold: f.get("threshold")
                  ? Math.round(Number(f.get("threshold")) * 100)
                  : null,
              });
              onChange();
              toast.success(
                "Mağaza eklendi. URL erişimi için sunucu izin listesine alan adını ekleyin.",
              );
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          <label className="field">
            Mağaza adı
            <input name="name" required />
          </label>
          <label className="field">
            Alan adı
            <input name="domain" required placeholder="www.magaza.com" />
          </label>
          <div className="two-fields">
            <label className="field">
              Kargo (₺)
              <input name="shipping" type="number" min="0" required />
            </label>
            <label className="field">
              Ücretsiz kargo sınırı (₺)
              <input name="threshold" type="number" min="0" />
            </label>
          </div>
          <Button type="submit">Mağazayı ekle</Button>
        </form>
      </details>
      <details className="surface admin-add">
        <summary>Canonical ürünleri birleştir</summary>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await api("admin/merge-products", "POST", {
                sourceId: f.get("source"),
                targetId: f.get("target"),
              });
              onChange();
              toast.success("Ürünler birleştirildi.");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          <p className="small muted">
            Farklı MPN’lere sahip ürünler birleştirilemez. Teklifleri,
            ihtiyaçları ve alarmları hedef ürüne taşır.
          </p>
          <label className="field">
            Kaynak ürün kimliği
            <input name="source" required />
          </label>
          <label className="field">
            Hedef ürün kimliği
            <input name="target" required />
          </label>
          <Button type="submit">Birleştir</Button>
        </form>
      </details>
    </div>
  );
}
function ReviewCard({
  review: r,
  products,
  onChange,
}: {
  review: Review;
  products: Product[];
  onChange: () => void;
}) {
  const [productId, setProductId] = useState(""),
    [exact, setExact] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="surface review-card"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!productId) return;
        const f = new FormData(e.currentTarget);
        setBusy(true);
        try {
          await api("admin/approve", "POST", {
            storeProductId: r.id,
            productId,
            packageQuantity: Number(f.get("package")),
            price: Math.round(Number(f.get("price")) * 100),
            vatRate: Number(f.get("vat")) / 100,
            vatIncluded: f.get("included") === "on",
            stockQuantity: f.get("stock") ? Number(f.get("stock")) : null,
            stockStatus: r.extracted.stockStatus || "unknown",
            matchType: exact ? "exact" : "verified",
            confidence: exact ? 100 : 95,
          });
          toast.success("Canlı teklif onaylandı.");
          onChange();
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{r.title}</h3>
      <a href={r.url} target="_blank" rel="noreferrer">
        Mağazada kontrol et ↗
      </a>
      <label className="field">
        Canonical ürün
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger>
            <SelectValue placeholder="Ürün seç" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem value={p.id} key={p.id}>
                {p.name} · {p.mpn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <div className="two-fields">
        <label className="field">
          Okunan paket fiyatı (₺)
          <input
            type="number"
            name="price"
            min="0"
            step="0.01"
            required
            defaultValue={(r.extracted.price || 0) / 100}
          />
        </label>
        <label className="field">
          Doğrulanan paket adedi
          <input
            type="number"
            name="package"
            min="1"
            required
            defaultValue={r.extracted.packageQuantity || ""}
          />
        </label>
      </div>
      <div className="two-fields">
        <label className="field">
          Doğrulanan KDV oranı (%)
          <input type="number" name="vat" min="0" max="100" required />
        </label>
        <label className="field">
          Stoktaki toplam adet (bilinmiyorsa boş)
          <input type="number" name="stock" min="0" />
        </label>
      </div>
      <label className="choice">
        <input
          type="checkbox"
          name="included"
          defaultChecked={r.extracted.vatIncluded === true}
        />
        Fiyat KDV dahil
      </label>
      <label className="choice">
        <Checkbox
          checked={exact}
          onCheckedChange={(v) => setExact(v === true)}
        />
        MPN, üretici ve teknik özellikler birebir doğrulandı
      </label>
      <Button type="submit" disabled={!productId || busy}>
        Doğrulanmış teklifi kaydet
      </Button>
    </form>
  );
}
