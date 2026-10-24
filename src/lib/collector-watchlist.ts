// Historical store_products are not a watchlist. Only actual user interest in
// live carts, favorites and enabled watches earns this bounded priority class.
export const COLLECTOR_WATCHLIST_SQL=`WITH interested AS (
 SELECT ci.canonical_product_id FROM cart_items ci JOIN carts c ON c.id=ci.cart_id WHERE c.data_source='live'
 UNION SELECT canonical_product_id FROM favorites
 UNION SELECT canonical_product_id FROM price_alerts WHERE enabled=1
 UNION SELECT canonical_product_id FROM stock_alerts WHERE enabled=1
) SELECT DISTINCT o.store_id AS storeId,o.product_url AS url FROM store_offers o JOIN interested i ON i.canonical_product_id=o.canonical_product_id WHERE o.source='live' ORDER BY o.store_id,o.product_url LIMIT 2000`;
