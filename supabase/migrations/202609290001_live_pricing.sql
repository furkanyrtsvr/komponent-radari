ALTER TABLE public.store_offers ADD COLUMN minimum_order_quantity integer NOT NULL DEFAULT 1 CHECK (minimum_order_quantity > 0);
ALTER TABLE public.store_offers ADD COLUMN order_step integer NOT NULL DEFAULT 1 CHECK (order_step > 0);
ALTER TABLE public.store_offers ADD COLUMN price_tiers text NOT NULL DEFAULT '[]';
ALTER TABLE public.store_offers ADD COLUMN last_error text;
ALTER TABLE public.store_offers ALTER COLUMN vat_rate DROP NOT NULL;
ALTER TABLE public.carts ADD COLUMN data_source text NOT NULL DEFAULT 'demo';
