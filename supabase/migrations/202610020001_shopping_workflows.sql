BEGIN;
CREATE TABLE public.cart_shipping_settings (
 id text PRIMARY KEY,
 cart_id text NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
 store_id text NOT NULL REFERENCES public.stores(id),
 shipping_price integer NOT NULL CHECK(shipping_price>=0),
 free_shipping_threshold integer CHECK(free_shipping_threshold>=0),
 updated_at text NOT NULL,
 UNIQUE(cart_id,store_id)
);
ALTER TABLE public.cart_shipping_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_read ON public.cart_shipping_settings FOR SELECT TO authenticated USING(public.eub_cart_access(cart_id));
CREATE FUNCTION public.eub_claim_guest(p_guest text,p_user text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_guest=p_user OR NOT EXISTS(SELECT 1 FROM users WHERE id=p_guest AND email='') OR NOT EXISTS(SELECT 1 FROM users WHERE id=p_user AND email<>'') THEN RAISE EXCEPTION 'Invalid account transfer'; END IF;
 PERFORM id FROM users WHERE id=p_guest FOR UPDATE;
 UPDATE cart_members m SET role=CASE
  WHEN m.role='owner' OR g.role='owner' THEN 'owner'
  WHEN m.role='editor' OR g.role='editor' THEN 'editor'
  WHEN m.role='contributor' OR g.role='contributor' THEN 'contributor' ELSE 'viewer' END
 FROM cart_members g WHERE m.user_id=p_user AND g.user_id=p_guest AND m.cart_id=g.cart_id;
 DELETE FROM cart_members WHERE user_id=p_guest AND cart_id IN(SELECT cart_id FROM cart_members WHERE user_id=p_user);
 UPDATE cart_members SET user_id=p_user WHERE user_id=p_guest;
 UPDATE carts SET owner_id=p_user,updated_at=to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') WHERE owner_id=p_guest;
 UPDATE cart_items SET added_by=p_user WHERE added_by=p_guest;
 DELETE FROM favorites WHERE user_id=p_guest AND canonical_product_id IN(SELECT canonical_product_id FROM favorites WHERE user_id=p_user);
 UPDATE favorites SET user_id=p_user WHERE user_id=p_guest;
 DELETE FROM price_alerts WHERE user_id=p_guest AND canonical_product_id IN(SELECT canonical_product_id FROM price_alerts WHERE user_id=p_user);
 DELETE FROM stock_alerts WHERE user_id=p_guest AND canonical_product_id IN(SELECT canonical_product_id FROM stock_alerts WHERE user_id=p_user);
 UPDATE price_alerts SET user_id=p_user WHERE user_id=p_guest;
 UPDATE stock_alerts SET user_id=p_user WHERE user_id=p_guest;
 DELETE FROM sessions WHERE user_id=p_guest;
END $$;
REVOKE ALL ON FUNCTION public.eub_claim_guest(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eub_claim_guest(text,text) TO service_role;
COMMIT;
