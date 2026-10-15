BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX products_name_trgm ON public.canonical_products USING gin (name gin_trgm_ops);
CREATE INDEX products_search_text ON public.canonical_products USING gin (to_tsvector('simple',name || ' ' || mpn || ' ' || manufacturer));
ALTER TABLE public.cart_items ADD CONSTRAINT positive_quantity CHECK(quantity>0 AND quantity<=100000);
ALTER TABLE public.store_offers ADD CONSTRAINT valid_offer CHECK(price_gross>=0 AND price_net>=0 AND package_quantity>0 AND match_confidence BETWEEN 0 AND 100);
ALTER TABLE public.cart_members ADD CONSTRAINT valid_role CHECK(role IN ('owner','viewer','contributor','editor'));
ALTER TABLE public.cart_shares ADD CONSTRAINT valid_share_role CHECK(role IN ('viewer','contributor','editor'));
CREATE FUNCTION public.eub_cart_access(target text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM cart_members WHERE cart_id=target AND user_id=auth.uid()::text)
$$;
REVOKE ALL ON FUNCTION public.eub_cart_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.eub_cart_access(text) TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','sessions','stores','store_shipping_rules','canonical_products','product_specs','store_products','store_offers','price_history','carts','cart_items','cart_members','cart_shares','cart_snapshots','saved_optimizations','favorites','price_alerts','stock_alerts','product_match_candidates','scrape_jobs','store_health','rate_limits'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['stores','canonical_products','product_specs','store_offers','price_history'] LOOP
 EXECUTE format('CREATE POLICY catalog_read ON public.%I FOR SELECT TO anon,authenticated USING (true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['cart_items','cart_members','cart_snapshots','saved_optimizations'] LOOP
 EXECUTE format('CREATE POLICY member_read ON public.%I FOR SELECT TO authenticated USING (public.eub_cart_access(cart_id))',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['favorites','price_alerts','stock_alerts'] LOOP
 EXECUTE format('CREATE POLICY own_read ON public.%I FOR SELECT TO authenticated USING (user_id=auth.uid()::text)',t);
 END LOOP;
END $$;
CREATE POLICY own_profile ON public.users FOR SELECT TO authenticated USING(id=auth.uid()::text);
CREATE POLICY cart_read ON public.carts FOR SELECT TO authenticated USING(public.eub_cart_access(id));
-- All writes go through authenticated/authorized server endpoints. Browser gets no service-role key.
CREATE FUNCTION public.eub_insert_batch(entries jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE entry jsonb; target text; BEGIN
 IF jsonb_array_length(entries)>500 THEN RAISE EXCEPTION 'batch too large'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(entries) LOOP
 target=entry->>'table';
 IF target NOT IN ('carts','cart_members','cart_items','cart_snapshots','saved_optimizations','store_offers','price_history','store_products') THEN RAISE EXCEPTION 'table not allowed'; END IF;
 EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I,$1)',target,target) USING entry->'row';
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.eub_insert_batch(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eub_insert_batch(jsonb) TO service_role;
CREATE FUNCTION public.eub_rate_limit(bucket_id text,expires bigint) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; BEGIN
 INSERT INTO rate_limits(id,count,expires_at) VALUES(bucket_id,1,expires) ON CONFLICT(id) DO UPDATE SET count=rate_limits.count+1 RETURNING count INTO n;
 RETURN n;
END $$;
-- SQLite accepts 64-bit integers; PostgreSQL's expiry column must be bigint for epoch ms.
ALTER TABLE public.rate_limits ALTER COLUMN expires_at TYPE bigint;
REVOKE ALL ON FUNCTION public.eub_rate_limit(text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eub_rate_limit(text,bigint) TO service_role;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='cart_items' AND schemaname='public') THEN
 ALTER PUBLICATION supabase_realtime ADD TABLE public.cart_items;
 END IF;
END $$;
COMMIT;
