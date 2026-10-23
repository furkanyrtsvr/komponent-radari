"use client";
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  Boxes,
  Cable,
  CircuitBoard,
  Cpu,
  Gauge,
  PackageSearch,
  Plug,
  ScanSearch,
  ShoppingCart,
  ToggleLeft,
  Zap,
  CircleAlert,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api,ApiError } from "@/lib/client";
import {previewWait} from '@/lib/preview-schedule';
import type { Offer, Store } from "@/lib/domain";
import { money } from "@/lib/domain";
import { hasObservedPrice, isFresh } from "@/lib/pricing";
import { catalogIdentity } from "@/lib/catalog-identity";
import type { CatalogPreview } from "@/lib/server/catalog-preview";
import {catalogFeedback} from '@/lib/feedback-catalog';
import type {FeedbackContext} from '@/lib/feedback';

type Source = { storeId: string; url: string; sourceCategory: string; name?:string };
const previewObserved=(p:CatalogPreview)=>Boolean(p.price && Number.isFinite(Date.parse(p.checkedAt)) && Date.parse(p.checkedAt)<=Date.now() && Date.now()-Date.parse(p.checkedAt)<(p.maxAgeMs||20*60*1000));
type IndexedProduct = {
  key: string;
  name: string;
  shortName?: string;
  group: string;
  sources: Source[];
};
type Manifest = {
  generatedAt: string;
  total: number;
  groups: string[];
  stores: {
    id: string;
    count: number;
    categories: { name: string; url: string }[];
    discovery?:{complete:boolean;reason:string};
  }[];
};
type SearchResponse = {
  requestId: number;
  done?: boolean;
  results?: IndexedProduct[];
  count?: number | null;
  progress?: number;
  chunks?: number;
  errors?: number;
  hasMore?: boolean;
  error?: string;
};

const categoryIcons: [
  RegExp,
  ComponentType<{ size?: number; strokeWidth?: number }>,
][] = [
  [/Geliştirme|Kart/i, CircuitBoard],
  [/Kablo/i, Cable],
  [/Buton/i, ToggleLeft],
  [/Entegre/i, Cpu],
  [/Güç|Pil/i, Zap],
  [/Bağlantı/i, Plug],
  [/Ölçüm|Test/i, Gauge],
  [/Modül|Motor|Sensör/i, Boxes],
];

function ProductVisual({
  group,
  image,
  name,
  onImageError,
}: {
  group: string;
  image?: string | null;
  name: string;
  onImageError?: (image: string) => void;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const Icon =
    categoryIcons.find(([pattern]) => pattern.test(group))?.[1] ||
    PackageSearch;
  return (
    <div className="merchant-product-visual">
      {image && failed !== image ? (
        <img src={image} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => {setFailed(image);onImageError?.(image);}} />
      ) : (
        <Icon size={50} strokeWidth={1.25} />
      )}
    </div>
  );
}

export function MerchantCatalog({
  query,
  stores,
  offers,
  onAdd,
  busy,
  onReport,
}: {
  query: string;
  stores: Store[];
  offers: Offer[];
  onAdd: (urls: string[], category: string) => Promise<void>;
  busy: boolean;
  onReport:(context:FeedbackContext)=>void;
}) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [group, setGroup] = useState("all");
  const [store, setStore] = useState("all");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<IndexedProduct[]>([]);
  const [status, setStatus] = useState<SearchResponse | null>(null);
  const [selected, setSelected] = useState<IndexedProduct | null>(null);
  const [previews, setPreviews] = useState<
    Record<string, CatalogPreview>
  >({});
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const attemptedPreviews = useRef(new Set<string>());
  const previewLive = useRef(true);
  const previewPending = useRef(false);
  const previewStarted = useRef(0),previewBlockedUntil=useRef(0);
  const forcePreviewUrls = useRef(new Set<string>());
  const [previewRevision, setPreviewRevision] = useState(0);
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);

  useEffect(() => {
    previewLive.current = true;
    return () => { previewLive.current = false; };
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/catalog/manifest.json")
      .then((response) => response.json() as Promise<Manifest>)
      .then((next) => {
        if (live) setManifest(next);
      })
      .catch(() => {
        if (live)
          setStatus({ requestId: 0, error: "Ürün kataloğu yüklenemedi." });
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!manifest) return;
    const nextWorker = new Worker("/catalog/search-worker.js?v=20261023-discovery2", {type:"module"});
    worker.current = nextWorker;
    nextWorker.onmessage = (event: MessageEvent<SearchResponse>) => {
      if (event.data.requestId !== request.current) return;
      if (event.data.results) {
        setRows(event.data.results);
        setSelected(current => current ? event.data.results?.find(row => row.key === current.key) || current : null);
      }
      setStatus(event.data);
    };
    return () => {
      nextWorker.terminate();
      worker.current = null;
    };
  }, [manifest]);

  useEffect(() => {
    setPage(0);
  }, [query]);

  useEffect(() => {
    if (!worker.current || !manifest) return;
    const id = ++request.current;
    setRows([]);
    setSelected(null);
    setStatus({ requestId: id, progress: 0, chunks: 1 });
    const timer = setTimeout(() => worker.current?.postMessage({ requestId: id, query, group, store, page }), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query, group, store, page, manifest]);

  useEffect(() => {
    if (previewPending.current) return;
    const delay=previewWait(previewStarted.current,previewBlockedUntil.current);
    if(delay){const timer=setTimeout(()=>setPreviewRevision(current=>current+1),delay);return()=>clearTimeout(timer);}
    const urls = [...(selectedProduct?.sources.map(source => source.url) || []), ...rows
      .slice(0, 40)
      .flatMap(row => row.sources.map(source=>source.url))]
      .filter((url): url is string => Boolean(url))
      .filter((url) => !attemptedPreviews.current.has(url))
      .filter((url,index,all)=>all.findIndex(other=>new URL(other).hostname===new URL(url).hostname)===index)
      .slice(0, 4);
    if (!urls.length) return;
    previewPending.current = true;
    previewStarted.current=Date.now();
    urls.forEach((url) => attemptedPreviews.current.add(url));
    const force = urls.some(url=>forcePreviewUrls.current.has(url));
    urls.forEach(url=>forcePreviewUrls.current.delete(url));
    void api<CatalogPreview[]>("catalog/preview", "POST", { urls, force })
      .then((items) => {
        if (!previewLive.current) return;
        setPreviews((current) => ({
          ...current,
          ...Object.fromEntries(items.map((item) => [item.url, item])),
        }));
      })
      .catch((error:unknown) => {
        const limited=error instanceof ApiError&&error.status===429;
        if(limited){previewBlockedUntil.current=Date.now()+60000;urls.forEach(url=>{attemptedPreviews.current.delete(url);if(force)forcePreviewUrls.current.add(url);});}
        if (previewLive.current) setPreviews(current => ({...current,...Object.fromEntries(urls.map(url => [url,{url,name:"",image:null,key:"",price:null,stockStatus:"unknown",checkedAt:new Date().toISOString(),message:limited?'Fiyat kontrolü sırada; istek sınırından sonra yeniden denenecek.':error instanceof Error?error.message:'Mağaza bilgisi yüklenemedi.'}]))}));
      })
      .finally(() => {
        previewPending.current = false;
        if (previewLive.current) setPreviewRevision(current => current + 1);
      });
  }, [rows, previews, selected, previewRevision, failedImages]);

  const sourceStore = (id: string) =>
    stores.find((candidate) => candidate.id === id)?.name || id;
  const verifiedRow=(row:IndexedProduct):IndexedProduct=>{
    // Sitemap names may lose fractions, decimal points or dimensions. The
    // title read from this card's own merchant page is the authoritative key.
    const anchor=row.sources.map(source=>previews[source.url]).find(preview=>preview?.name && preview.key && preview.price);
    if(!anchor) return row;
    const sources=[...row.sources,...(anchor.sources || []).map(source=>({...source,sourceCategory:row.group}))];
    return {...row,key:anchor.key,name:anchor.name,shortName:anchor.name,
      sources:[...new Map(sources.map(source=>[source.url,source])).values()]};
  };
  const selectedProduct=selected ? verifiedRow(selected) : null;
  const representativeSources=(row:IndexedProduct)=>{
    const perStore=new Map<string,Source>();
    const cost=(source:Source)=>{
      const p=previews[source.url];
      if(p?.key===row.key && p.price && p.stockStatus==='in_stock' && previewObserved(p)) return p.price;
      if(p?.price && previewObserved(p)) return Infinity;
      const offer=offers.find(o=>o.product_url===source.url && catalogIdentity({name:o.title})===row.key && isFresh(o) && o.stock_status==='in_stock');
      return offer?.price_gross || Infinity;
    };
    for(const source of row.sources) {const previous=perStore.get(source.storeId);if(!previous || cost(source)<cost(previous))perStore.set(source.storeId,source);}
    return [...perStore.values()];
  };
  const checkedPrice = (url: string, key: string) => {
    const preview = previews[url];
    if (preview?.key === key && preview.price && preview.stockStatus === "in_stock" && previewObserved(preview)) return money(preview.price);
    if (preview?.price && previewObserved(preview)) return null;
    const offer = offers.find(
      (candidate) =>
        candidate.product_url === url &&
        catalogIdentity({name:candidate.title}) === key &&
        isFresh(candidate) &&
        candidate.stock_status === "in_stock",
    );
    return offer ? money(offer.price_gross) : null;
  };
  const imageFor = (row: IndexedProduct | null) =>
    row?.sources
      .map((source) => previews[source.url]?.key === row.key ? previews[source.url]?.image : offers.find(offer => offer.product_url === source.url && catalogIdentity({name:offer.title}) === row.key)?.image_url)
      .sort((a,b)=>Number(/witcdn\./i.test(a || ''))-Number(/witcdn\./i.test(b || '')))
      .find(image => Boolean(image) && !failedImages.includes(image!)) || null;
  const imageFailed = (image: string) => setFailedImages(current => current.includes(image) ? current : [...current,image]);
  const selectedStore = manifest?.stores.find(
    (candidate) => candidate.id === store,
  );

  return (
    <section className="merchant-catalog" aria-label="Ürün kataloğu">
      <div className="merchant-catalog-head">
        <div>
          <span className="catalog-kicker">ELEKTRONİK KOMPONENT PAZARI</span>
          <h2>Ürünler</h2>
          <p>
            {manifest
              ? `${manifest.total.toLocaleString("tr-TR")} mağaza kaydı · ${manifest.stores.length} mağaza`
              : "Katalog yükleniyor…"}
          </p>
        </div>
        <label>
          Mağaza
          <select
            value={store}
            onChange={(event) => {
              setStore(event.target.value);
              setPage(0);
            }}
          >
            <option value="all">Tüm mağazalar</option>
            {stores.map((candidate) => (
              <option value={candidate.id} key={candidate.id}>
                {candidate.name} (
                {manifest?.stores
                  .find((entry) => entry.id === candidate.id)
                  ?.count.toLocaleString("tr-TR") || "dizin entegrasyonu yok"}
                  {manifest?.stores.find(entry=>entry.id===candidate.id)?.discovery?.complete===false?" · kısmi dizin":""}
                )
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="merchant-category-list" aria-label="Ürün kategorileri">
        <button
          className={group === "all" ? "active" : ""}
          onClick={() => {
            setGroup("all");
            setPage(0);
          }}
        >
          Tümü
        </button>
        {manifest?.groups.map((entry) => (
          <button
            key={entry}
            className={group === entry ? "active" : ""}
            onClick={() => {
              setGroup(entry);
              setPage(0);
            }}
          >
            {entry}
          </button>
        ))}
      </nav>

      {selectedStore?.discovery?.complete===false&&<p className="catalog-source-note">{selectedStore.discovery.reason}</p>}
      {selectedStore && selectedStore.categories.length>0 && (
        <details className="source-categories">
          <summary>{sourceStore(store)} kategorilerine göz at</summary>
          <div>
            {selectedStore.categories.map((sourceCategory) => (
              <a
                key={sourceCategory.url}
                href={sourceCategory.url}
                target="_blank"
                rel="noreferrer"
              >
                {sourceCategory.name}
              </a>
            ))}
          </div>
        </details>
      )}

      {/^(https:\/\/)/i.test(query.trim()) && (
        <button
          className="catalog-direct-add"
          disabled={busy}
          onClick={() => void onAdd([query.trim()], "Diğer")}
        >
          Bu bağlantıdaki ürünü sepete ekle
        </button>
      )}
      {status?.error && <p className="error-box">{status.error}</p>}
      {Boolean(status?.errors) && <p className="error-box">Bazı katalog bölümleri yüklenemedi. Gösterilen sonuçlar eksik olabilir.</p>}
      {!status?.done && !status?.error && (
        <div className="catalog-progress" role="status">
          <ScanSearch size={16} />
          <span>{query ? `“${query}” aranıyor` : "Ürünler hazırlanıyor"}</span>
          <i
            style={{
              width: `${Math.min(100, ((status?.progress || 0) / Math.max(1, status?.chunks || 1)) * 100)}%`,
            }}
          />
        </div>
      )}

      <div className="merchant-results">
        {rows.map((original) => {const row=verifiedRow(original);return (
          <button
            className="merchant-result"
            key={original.key}
            onClick={() => setSelected(original)}
          >
            <ProductVisual
              group={row.group}
              image={imageFor(row)}
              name={row.shortName || row.name}
              onImageError={imageFailed}
            />
            <h3>{row.shortName || row.name}</h3>
            <p className="merchant-card-price">{(() => {
              const prices=row.sources.map(source=>previews[source.url]).filter(p=>p?.key===row.key&&p.stockStatus==='in_stock'&&previewObserved(p));
              if(prices.length)return [...new Set(prices.map(p=>p.unitType==='metre'?'metre':row.key.startsWith('cable:jumper:')?'set':'adet'))].map(unit=>`${money(Math.min(...prices.filter(p=>(p.unitType==='metre'?'metre':row.key.startsWith('cable:jumper:')?'set':'adet')===unit).map(p=>Math.round(p.price!/(p.packageQuantity||1)))))} / ${unit}`).join(' · ');
              const soldOut=row.sources.map(source=>previews[source.url]).filter(p=>p?.key===row.key&&p.stockStatus==='out_of_stock'&&previewObserved(p));
              if(soldOut.length)return `${money(Math.min(...soldOut.map(p=>Math.round(p.price!/(p.packageQuantity||1)))))} · Stokta yok`;
              return row.sources.every(source=>attemptedPreviews.current.has(source.url)&&previews[source.url]) ? 'Fiyat doğrulanamadı' : 'Fiyatlar kontrol ediliyor…';
            })()}</p>
          </button>
        );})}
      </div>

      {status?.done && !rows.length && (
        <div className="merchant-empty">
          <PackageSearch size={38} />
          <strong>Ürün bulunamadı</strong>
          <span>Model kodunu veya ürün adını farklı yazarak tekrar ara.</span>
        </div>
      )}

      {status?.done && (
        <div className="catalog-pagination">
          <span>
            {status.count === null || status.count === undefined
              ? "Katalogda geziniyorsun"
              : `${status.count.toLocaleString("tr-TR")} ürün`}
          </span>
          <div>
            <button
              disabled={page === 0}
              onClick={() => setPage((current) => current - 1)}
            >
              Önceki
            </button>
            <span>{page + 1}. sayfa</span>
            <button
              disabled={!status.hasMore}
              onClick={() => setPage((current) => current + 1)}
            >
              Sonraki
            </button>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="merchant-product-dialog">
          {selectedProduct && (
            <>
              <button type="button" className="report-comparison-button catalog-report-button" aria-label="Bu ürün kaydında hata bildir" onClick={()=>onReport(catalogFeedback(selectedProduct,previews,stores,{query,group,store,page}))}><CircleAlert size={19}/><span>Hata bildir</span></button>
              <div className="merchant-dialog-layout">
                <ProductVisual
                  group={selectedProduct.group}
                  image={imageFor(selectedProduct)}
                  name={selectedProduct.shortName || selectedProduct.name}
                  onImageError={imageFailed}
                />
                <DialogHeader>
                  <span className="category-tag">{selectedProduct.group}</span>
                  <DialogTitle>{selectedProduct.shortName || selectedProduct.name}</DialogTitle>
                  <DialogDescription>{selectedProduct.name}</DialogDescription>
                </DialogHeader>
              </div>
              <div className="merchant-dialog-sources">
                {representativeSources(selectedProduct).map((source) => (
                  <div key={source.url}>
                    <div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {sourceStore(source.storeId)}
                      </a>
                      <span title={previews[source.url]?.message || undefined}>
                        {checkedPrice(source.url,selectedProduct.key) || (previews[source.url]
                          ? previews[source.url].key && previews[source.url].key !== selectedProduct.key ? "Ürün bilgisi eşleşmedi" : previews[source.url].collectorPending ? "Toplayıcı yenilemesi bekleniyor" : previews[source.url].stockStatus === "out_of_stock" ? "Stokta yok" : "Fiyat doğrulanamadı"
                          : "Mağaza kontrol ediliyor…")}
                        {checkedPrice(source.url,selectedProduct.key) ? previews[source.url]?.unitType==='metre' ? " / metre · KDV dahil" : selectedProduct.key.startsWith("cable:jumper:") ? " / set · KDV dahil" : ` / ${previews[source.url]?.packageQuantity && previews[source.url].packageQuantity!>1 ? `${previews[source.url].packageQuantity} adetlik paket` : "adet"} · KDV dahil` : ""}
                        {previews[source.url]?.collectorManaged ? " · Toplayıcı arşivi" : previews[source.url]?.retained ? " · son doğrulanan fiyat" : ""}
                        {checkedPrice(source.url,selectedProduct.key) && <small>Son kontrol · {new Date(previews[source.url]?.checkedAt || offers.find(o=>o.product_url===source.url)?.last_checked_at || '').toLocaleString('tr-TR')}</small>}
                      </span>
                      {previews[source.url]?.message && !checkedPrice(source.url,selectedProduct.key) && <small>{previews[source.url].message}</small>}
                    </div>
                  </div>
                ))}
              </div>
              <button className="merchant-dialog-refresh" disabled={previewPending.current || busy} onClick={() => {
                selectedProduct.sources.forEach(source => attemptedPreviews.current.delete(source.url));
                selectedProduct.sources.forEach(source=>forcePreviewUrls.current.add(source.url));
                setPreviews(current => Object.fromEntries(Object.entries(current).filter(([url]) => !selectedProduct.sources.some(source => source.url === url))));
                setPreviewRevision(current => current + 1);
              }}>Teklifleri yenile</button>
              <button
                className="merchant-dialog-add"
                disabled={busy}
                onClick={() =>
                  void onAdd(
                    representativeSources(selectedProduct).map((source) => source.url),
                    selectedProduct.group,
                  )
                }
              >
                <ShoppingCart size={17} /> Tüm mağazaları eşleştir ve sepete ekle
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
