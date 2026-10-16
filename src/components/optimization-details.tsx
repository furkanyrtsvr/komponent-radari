import { money, type Optimization, type Scenario, type Product, type Store } from "@/lib/domain";

export function OptimizationDetails({ result, scenario, products, stores }: {
  result: Optimization; scenario: Scenario; products: Map<string, Product>; stores: Map<string, Store>;
}) {
  const rows = result.comparison || [];
  const offers = new Map([...rows.flatMap(r => r.cells.flatMap(c => c.offer ? [[c.offer.id, c.offer] as const] : [])),...(result.eligibleOffers || []).map(offer=>[offer.id,offer] as const)]);
  return <div className="purchase-details">
    <section className="surface purchase-plan">
      <h3>Hangi ürünü nereden almalısın?</h3>
      <p className="muted small">Seçilen plan: {scenario.storeCount} ayrı sipariş · Ürünler {money(scenario.productTotal)} + kargo {money(scenario.shippingTotal)} = <strong>{money(scenario.total)}</strong></p>
      {scenario.groups.map(g => {
        const lines = new Map<string, { productId: string; offerId: string; quantity: number; purchasedQuantity: number; total: number }>();
        for (const l of g.lines) {
          const prev = lines.get(l.offerId);
          lines.set(l.offerId, prev ? { ...prev, quantity: prev.quantity + l.quantity, purchasedQuantity: prev.purchasedQuantity + l.purchasedQuantity, total: prev.total + l.total } : { ...l });
        }
        return <article className="purchase-store" key={g.storeId}>
          <h4>{stores.get(g.storeId)?.name} <strong>{money(g.subtotal + g.shipping)}</strong></h4>
          <div className="comparison-scroll"><table className="purchase-table"><thead><tr><th>Alınacak ürün</th><th>İstenen</th><th>Satın alınacak</th><th>Ürün toplamı</th><th>Ürün bağlantısı</th></tr></thead><tbody>
            {[...lines.values()].map(l => <tr key={l.offerId}><td>{products.get(l.productId)?.name || l.productId}</td><td>{l.quantity} adet</td><td><strong>{l.purchasedQuantity} adet</strong></td><td>{money(l.total)}<small>Son kontrol · {offers.get(l.offerId)?.last_checked_at && new Date(offers.get(l.offerId)!.last_checked_at).toLocaleString("tr-TR")}</small></td><td>{offers.get(l.offerId)?.product_url && <a href={offers.get(l.offerId)!.product_url} target="_blank" rel="noreferrer">Ürünü mağazada aç ↗</a>}</td></tr>)}
          </tbody></table></div>
          <p className="muted small">Ürünler {money(g.subtotal)} + {g.freeShipping ? "ücretsiz kargo" : `${money(g.shipping)}${result.shippingEstimated ? " tahmini" : ""} kargo`}</p>
        </article>;
      })}
    </section>
    {!!rows.length && <section className="surface purchase-plan">
      <h3>Ürün ürün mağaza karşılaştırması</h3>
      <p className="muted small">Seçili mağazaların tamamı aşağıdadır. Tutarlar istenen adet için KDV, minimum sipariş ve paket yuvarlaması dahil ürün toplamıdır. “Teklif yok” görünen mağazada bu ürün için doğrulanmış fiyat bulunmadığından o mağaza alışveriş planına alınamaz.</p>
      <div className="comparison-scroll"><table className="purchase-table"><thead><tr><th>Ürün / istenen adet</th>{result.comparedStoreIds?.map(id => <th key={id}>{stores.get(id)?.name}</th>)}</tr></thead><tbody>
        {rows.map(r => <tr key={r.itemIds.join("|")}><td>{products.get(r.productId)?.name}<br/><small>{r.quantity} adet</small></td>{r.cells.map(c => {
          const lines = scenario.groups.find(g=>g.storeId===c.storeId)?.lines.filter(line=>r.itemIds.includes(line.itemId)) || [];
          const chosen = lines.length > 0;
          const selectedOffer=chosen ? offers.get(lines[0].offerId) : c.offer;
          const cost=chosen ? lines.reduce((sum,line)=>sum+line.total,0) : c.cost;
          const quantity=chosen ? lines.reduce((sum,line)=>sum+line.purchasedQuantity,0) : c.purchasedQuantity;
          return <td key={c.storeId} className={chosen ? "chosen-quote" : ""}>{selectedOffer && cost !== undefined ? <><a href={selectedOffer.product_url} target="_blank" rel="noreferrer">{money(cost)} ↗</a><small>{quantity} adet satın alım{chosen ? " · ✓ Bu mağazadan al" : ""}</small><small>Son kontrol · {new Date(selectedOffer.last_checked_at).toLocaleString("tr-TR")}</small></> : <span className="muted small">{c.reason}</span>}</td>;
        })}</tr>)}
      </tbody></table></div>
    </section>}
  </div>;
}
