BEGIN;
CREATE TABLE public.cart_offer_selections (
 id text PRIMARY KEY,
 cart_id text NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
 canonical_product_id text NOT NULL REFERENCES public.canonical_products(id),
 offer_id text NOT NULL REFERENCES public.store_offers(id) ON DELETE CASCADE,
 excluded integer NOT NULL DEFAULT 0 CHECK(excluded IN(0,1)),
 updated_at text NOT NULL,
 UNIQUE(cart_id,canonical_product_id,offer_id)
);
ALTER TABLE public.cart_offer_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_read ON public.cart_offer_selections FOR SELECT TO authenticated USING(public.eub_cart_access(cart_id));
COMMIT;
