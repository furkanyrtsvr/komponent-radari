"use client";
import {useEffect,useState} from "react";
import {Button} from "./ui/button";
import {api} from "@/lib/client";
import {money,type CartView,type Store,type Product,type Offer} from "@/lib/domain";
import {isFresh,quoteOffer} from "@/lib/pricing";
import {toast} from "sonner";
import type {linkQuotes} from "@/lib/link-quotes";
import type {VisualMatch} from '@/lib/visual-match';

export type LinkResult={product:Product;referenceOfferId?:string;cart:CartView;quotes:ReturnType<typeof linkQuotes>;excludedQuotes?:ReturnType<typeof linkQuotes>;availability?:{store:string;url:string;status:string;price:number}[];quantity:number;message:string;refreshSummary:string};
export type Watch={id:string;canonical_product_id:string;enabled:number;target_price?:number};
export function LinkComparison({result,onExclude,busy,editable}:{result:LinkResult;onExclude:(offerId:string,excluded:boolean)=>void;busy:boolean;editable:boolean}){
  const quotes=result.quotes.filter(q=>!q.variantConflict).sort((a,b)=>a.productTotal-b.productTotal || a.store.localeCompare(b.store));
  const different=result.quotes.filter(q=>q.variantConflict);
  const best=quotes[0];
  const [visual,setVisual]=useState<Record<string,VisualMatch>>({});
  const visualKey=result.product.id+':'+quotes.slice(0,24).map(q=>q.offerId).join(',');
  useEffect(()=>{let alive=true;setVisual({});if(quotes.length)void api<Record<string,VisualMatch>>('visual-match','POST',{productId:result.product.id,referenceOfferId:result.referenceOfferId,offerIds:quotes.slice(0,24).map(q=>q.offerId)}).then(value=>{if(alive)setVisual(value);}).catch(()=>{if(alive)setVisual(Object.fromEntries(quotes.map(q=>[q.offerId,'unavailable'])));});return()=>{alive=false;};},[visualKey,result.referenceOfferId]);
  const photoLabel=(id:string)=>visual[id]==='same-photo'?'Aynı ürün fotoğrafı':visual[id]==='similar-photo'?'Fotoğraf benzerliği destekliyor':visual[id]==='different-photo'?'Farklı fotoğraf · Görünümünü kontrol et':visual[id]==='unavailable'?'Fotoğraf benzerliği doğrulanamadı':'Fotoğraf karşılaştırılıyor…';
  return <div className="link-result"><div className="link-product-heading">{result.product.image&&<img className="quote-photo reference-photo" src={result.product.image} alt={result.product.name} referrerPolicy="no-referrer"/>}<h3>{result.product.name}</h3></div><p>{result.message}</p>
    {!!best && <div className="link-best"><span>En düşük ürün tutarı · {result.quantity} adet ihtiyaç</span><strong>{money(best.productTotal)}</strong><a href={best.url} target="_blank" rel="noreferrer">{best.store} ürününü aç</a></div>}
    {!!quotes.length && <div className="comparison-scroll"><table className="purchase-table"><thead><tr><th>Mağaza / ürün</th><th>Satın alınan miktar</th><th>Ürün tutarı</th><th/></tr></thead><tbody>{quotes.map(quote=><tr key={quote.offerId}><td><div className="quote-product">{quote.image&&<a href={quote.url} target="_blank" rel="noreferrer"><img className="quote-photo" src={quote.image} alt={quote.title} loading="lazy" referrerPolicy="no-referrer"/></a>}<div><a href={quote.url} target="_blank" rel="noreferrer">{quote.store}</a><small>{quote.title}</small><small>{quote.nameMatch?'Model ve ürün türü uyumlu · Özellikleri kontrol et':'Aynı ürün eşleşmesi'}</small><small className="muted">{photoLabel(quote.offerId)}</small></div></div></td><td>{quote.purchasedQuantity} {quote.unitType || "adet"}</td><td><strong>{money(quote.productTotal)}</strong><small>{quote.lastKnown?"Son alınan fiyat":"Son kontrol"} · {new Date(quote.checkedAt).toLocaleString("tr-TR")}</small></td><td><Button variant="ghost" disabled={busy || !editable} aria-label={`${quote.store}: ${quote.title} teklifini çıkar`} onClick={()=>onExclude(quote.originalOfferId,true)}>×</Button></td></tr>)}</tbody></table></div>}
    {!!different.length&&<details className="different-products"><summary>Farklı ürünler karşılaştırmaya alınmadı ({different.length})</summary><p className="muted small">Ortak bir parça adı bulunuyor ancak ürün türü veya donanımı farklı. Bu fiyatlar en ucuz teklif ve sepet hesabına katılmaz.</p>{different.map(quote=><p key={quote.offerId}><a href={quote.url} target="_blank" rel="noreferrer">{quote.store} · {quote.title}</a><small>{quote.variantConflict}</small></p>)}</details>}
    {!!result.availability?.filter(offer=>offer.status!=='in_stock').length && <div><h4>Bulunan ama stokta olmayan teklifler</h4>{result.availability.filter(offer=>offer.status!=='in_stock').map(offer=><p key={offer.url}><a href={offer.url} target="_blank" rel="noreferrer">{offer.store}</a> · {money(offer.price)} · {offer.status==='out_of_stock'?'Stokta yok':'Stok doğrulanamadı'}</p>)}</div>}
    {!!result.excludedQuotes?.length && <details><summary>Çıkardığın teklifler ({result.excludedQuotes.length})</summary>{result.excludedQuotes.map(quote=><p key={quote.offerId}>{quote.store} · {quote.title} · {money(quote.productTotal)} <Button variant="outline" disabled={busy || !editable} onClick={()=>onExclude(quote.originalOfferId,false)}>Geri al</Button></p>)}</details>}
    <p className="muted small">{result.refreshSummary} Mağazadaki ürün adı, varsa kendi açıklaması ve teknik özellikleri birlikte kontrol edilir. Fotoğraf benzerliği ek destek sağlar; tek başına teknik eşleşme sayılmaz. Uygun olmayan teklifi × ile bu sepetin karşılaştırmasından çıkarabilirsin.</p>
  </div>;
}

type Health={store_id:string;success:number;message:string;checked_at:string};
type Job={id:string;store_id:string;url:string;status:string;error:string|null;created_at:string;finished_at:string|null};
export function ShippingLogsPanel({stores,cart,onChange}:{stores:Store[];cart:CartView;onChange:(cart:CartView)=>void}){
  const [storeId,setStoreId]=useState("all"),[logs,setLogs]=useState<{health:Health[];jobs:Job[]}>({health:[],jobs:[]}),[error,setError]=useState("");
  const editable=["owner","editor"].includes(cart.role);
  useEffect(()=>{
    let alive=true;
    const read=()=>api<typeof logs>(`health${storeId==="all"?"":`?storeId=${encodeURIComponent(storeId)}`}`).then(data=>{if(alive){setLogs(data);setError("");}}).catch(error=>{if(alive)setError(error.message);});
    void read();const timer=setInterval(()=>{if(!document.hidden)void read();},15000);
    return ()=>{alive=false;clearInterval(timer);};
  },[storeId]);
  return <div className="shopping-panels"><section className="surface"><h2>Mağaza bazında kargo ayarları</h2><p className="muted">{cart.name} için geçerlidir. Ortak sepette bütün katılımcılar aynı ayarlarla hesaplar. Kaydettiğin ücretler senin tanımladığın değerlerdir; mağazanın ödeme tutarını ayrıca kontrol et.</p>
    <div className="shipping-settings-grid">{stores.map(store=><ShippingRow key={`${cart.id}:${store.id}:${store.shipping_base_price}:${store.free_shipping_threshold}`} store={store} cart={cart} editable={editable} onChange={onChange}/>)}</div>
  </section><section className="surface"><div className="section-title"><h2>Mağaza işlem kayıtları</h2><select aria-label="Kayıtları mağazaya göre filtrele" value={storeId} onChange={event=>setStoreId(event.target.value)}><option value="all">Bütün mağazalar</option>{stores.map(store=><option key={store.id} value={store.id}>{store.name}</option>)}</select></div><p className="muted small">Son 100 kontrol · Ekran açıkken 15 saniyede bir yenilenir.</p>{error && <p role="alert">{error}</p>}
    <div className="comparison-scroll"><table className="purchase-table"><thead><tr><th>Zaman</th><th>Mağaza</th><th>Durum</th><th>Ürün / Açıklama</th></tr></thead><tbody>{logs.jobs.map(job=><tr key={job.id}><td>{new Date(job.created_at).toLocaleString("tr-TR")}</td><td>{stores.find(store=>store.id===job.store_id)?.name}</td><td>{({running:"Kontrol sürüyor",completed:"Doğrulandı",failed:"Doğrulanamadı",needs_review:"İnceleme gerekli"} as Record<string,string>)[job.status] || job.status}</td><td><a href={job.url} target="_blank" rel="noreferrer">Ürün bağlantısı</a>{job.error && <small>{job.error}</small>}</td></tr>)}</tbody></table></div>
    {!logs.jobs.length && <p>Bu mağaza için henüz ürün kontrolü yapılmadı.</p>}
    <details><summary>Fiyat ve stok kontrol ayrıntıları</summary>{logs.health.map((row,i)=><p className="log-detail" key={`${row.checked_at}:${i}`}><strong>{stores.find(store=>store.id===row.store_id)?.name}</strong> · {new Date(row.checked_at).toLocaleString("tr-TR")} · {row.success?"Başarılı":"Başarısız"}<br/>{row.message}</p>)}</details>
  </section></div>;
}
function ShippingRow({store,cart,editable,onChange}:{store:Store;cart:CartView;editable:boolean;onChange:(cart:CartView)=>void}){
  const [fee,setFee]=useState(String(store.shipping_base_price/100)),[threshold,setThreshold]=useState(store.free_shipping_threshold===null?"":String(store.free_shipping_threshold/100)),[busy,setBusy]=useState(false);
  const save=async(reset=false)=>{
    setBusy(true);
    try{
      const result=reset ? await api<CartView>(`carts/${cart.id}/shipping?storeId=${store.id}`,"DELETE") : await api<CartView>(`carts/${cart.id}/shipping`,"PUT",{storeId:store.id,shippingPrice:Math.round(Number(fee)*100),freeShippingThreshold:threshold===""?null:Math.round(Number(threshold)*100)});
      onChange(result);toast.success(reset?"Mağazanın kargo bilgisine dönüldü.":"Sepetin kargo ayarı kaydedildi.");
    }catch(error){toast.error(error instanceof Error?error.message:"Kaydedilemedi.");}finally{setBusy(false);}
  };
  return <article className="shipping-setting"><h3>{store.name}</h3><span className="muted small">{store.shipping_manual?"Bu sepet için belirlediğin ücret":store.shipping_default?"Varsayılan kargo ayarı":store.shipping_known===false?"Kargo tutarı tahmini":"Mağaza bilgisi"}</span><label>Kargo ücreti (₺)<input aria-label={`${store.name} kargo ücreti`} type="number" min="0" step="0.01" value={fee} disabled={!editable} onChange={e=>setFee(e.target.value)}/></label><label>Ücretsiz kargo eşiği (₺)<input aria-label={`${store.name} ücretsiz kargo eşiği`} type="number" min="0" step="0.01" placeholder="Eşik yok" value={threshold} disabled={!editable} onChange={e=>setThreshold(e.target.value)}/></label><div className="panel-actions"><Button disabled={!editable || busy || fee===""} onClick={()=>void save()}>Kaydet</Button>{store.shipping_manual && <Button variant="outline" disabled={!editable || busy} onClick={()=>void save(true)}>Sıfırla</Button>}</div></article>;
}

export function WatchPanel({prices,stocks,products,offers,onChange,onRefresh,refreshing}:{prices:Watch[];stocks:Watch[];products:Product[];offers:Offer[];onChange:()=>void;onRefresh:(ids:string[])=>void;refreshing:boolean}){
  const [filter,setFilter]=useState("all"),[busy,setBusy]=useState("");
  const rows=[...prices.map(row=>({...row,kind:"price"})),...stocks.map(row=>({...row,kind:"stock"}))].filter(row=>filter==="all" || row.kind===filter);
  const change=async(row:Watch & {kind:string},method:string)=>{
    setBusy(row.id);
    try{await api(`alerts/${row.kind}/${row.id}`,method,method==="PATCH"?{enabled:!row.enabled}:undefined);onChange();}catch(error){toast.error(error instanceof Error?error.message:"Takip değiştirilemedi.");}finally{setBusy("");}
  };
  return <section className="surface alerts-panel"><div className="section-title"><h2>Fiyat ve stok takibi</h2><select aria-label="Takip türü filtresi" value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">Bütün takipler</option><option value="price">Fiyat hedefleri</option><option value="stock">Stok takibi</option></select></div><p className="muted">Güncel ve doğrulanmış mağaza tekliflerine göre uygulama içinde gösterilir. Uygulama açıkken 15 dakikada bir kontrol edilir. E-posta bildirimi gönderilmez.</p><Button disabled={refreshing || !rows.length} onClick={()=>onRefresh([...new Set(rows.filter(row=>row.enabled).map(row=>row.canonical_product_id))])}>{refreshing?"Kontrol ediliyor…":"Takipleri şimdi kontrol et"}</Button>
    {rows.map(row=>{
      const fresh=offers.filter(offer=>offer.canonical_product_id===row.canonical_product_id && isFresh(offer)),available=fresh.filter(offer=>offer.stock_status==="in_stock");
      const cost=available.length?Math.min(...available.map(offer=>quoteOffer(offer,1).cost)):null;
      const reached=row.kind==="stock"?available.length>0:cost!==null && cost<=(row.target_price || 0);
      return <article className="watch-row" key={`${row.kind}:${row.id}`}><div><h3>{products.find(product=>product.id===row.canonical_product_id)?.name || "Ürün"}</h3><p>{row.kind==="stock"?"Stok takibi":`Fiyat hedefi ${money(row.target_price || 0)} · 1 adet ihtiyaç için minimum satın alma tutarı`}</p><span className="muted">{!fresh.length?"Güncel doğrulanmış teklif yok":cost===null?"Stokta doğrulanmış teklif yok":`${available.length} mağaza teklifi · ${money(cost)}`}</span></div><strong>{!row.enabled?"Duraklatıldı":reached?row.kind==="stock"?"Stokta bulundu":"Hedefe ulaştı":"Takip ediliyor"}</strong><div className="panel-actions"><Button variant="outline" disabled={busy===row.id} onClick={()=>void change(row,"PATCH")}>{row.enabled?"Duraklat":"Devam et"}</Button><Button variant="ghost" disabled={busy===row.id} onClick={()=>void change(row,"DELETE")}>Kaldır</Button></div></article>;
    })}{!rows.length && <p>Ürün detayından fiyat hedefi veya stok takibi ekleyebilirsin.</p>}
  </section>;
}

