-- PostgreSQL/Supabase schema; money values are integer kuruş.
BEGIN;
CREATE TABLE "canonical_products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"manufacturer" text NOT NULL,
	"mpn" text NOT NULL,
	"model" text NOT NULL,
	"description" text NOT NULL,
	"image" text,
	"specifications" text NOT NULL,
	"unit_type" text NOT NULL,
	"package_quantity" integer NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "cart_items" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"canonical_product_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"added_by" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"allow_alternative" integer DEFAULT 0 NOT NULL,
	"preferred_manufacturer" text DEFAULT '' NOT NULL,
	"maximum_unit_price" integer,
	"created_at" text NOT NULL
);

CREATE TABLE "cart_members" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL
);

CREATE TABLE "cart_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL
);

CREATE TABLE "cart_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"created_at" text NOT NULL,
	"total" integer NOT NULL,
	"payload" text NOT NULL
);

CREATE TABLE "carts" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);

CREATE TABLE "favorites" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"canonical_product_id" text NOT NULL
);

CREATE TABLE "price_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"canonical_product_id" text NOT NULL,
	"target_price" integer NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "price_history" (
	"id" text PRIMARY KEY NOT NULL,
	"offer_id" text NOT NULL,
	"price_gross" integer NOT NULL,
	"stock_status" text NOT NULL,
	"checked_at" text NOT NULL
);

CREATE TABLE "product_match_candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"store_product_id" text NOT NULL,
	"canonical_product_id" text NOT NULL,
	"confidence" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text NOT NULL
);

CREATE TABLE "product_specs" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_product_id" text NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"unit" text
);

CREATE TABLE "rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" integer NOT NULL
);

CREATE TABLE "saved_optimizations" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"created_at" text NOT NULL,
	"payload" text NOT NULL
);

CREATE TABLE "scrape_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"url" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" text NOT NULL,
	"finished_at" text
);

CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" text NOT NULL
);

CREATE TABLE "stock_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"canonical_product_id" text NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "store_health" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"success" integer NOT NULL,
	"message" text NOT NULL,
	"checked_at" text NOT NULL
);

CREATE TABLE "store_offers" (
	"id" text PRIMARY KEY NOT NULL,
	"canonical_product_id" text NOT NULL,
	"store_id" text NOT NULL,
	"store_product_id" text NOT NULL,
	"title" text NOT NULL,
	"product_url" text NOT NULL,
	"image_url" text,
	"manufacturer" text NOT NULL,
	"mpn" text NOT NULL,
	"price_net" integer NOT NULL,
	"vat_rate" real NOT NULL,
	"price_gross" integer NOT NULL,
	"package_quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"currency" text NOT NULL,
	"vat_included" integer NOT NULL,
	"stock_status" text NOT NULL,
	"stock_quantity" integer,
	"match_confidence" integer NOT NULL,
	"match_type" text NOT NULL,
	"last_checked_at" text NOT NULL,
	"source" text NOT NULL
);

CREATE TABLE "store_products" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"mpn" text,
	"raw_data" text NOT NULL
);

CREATE TABLE "store_shipping_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"rules" text NOT NULL,
	"estimated" integer DEFAULT 1 NOT NULL,
	"source_url" text,
	"last_updated" text NOT NULL
);

CREATE TABLE "stores" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"color" text NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"adapter_type" text NOT NULL,
	"supports_search" integer NOT NULL,
	"supports_live_price" integer NOT NULL,
	"supports_stock" integer NOT NULL,
	"shipping_base_price" integer NOT NULL,
	"free_shipping_threshold" integer,
	"price_includes_vat" integer NOT NULL,
	"last_successful_sync" text,
	"status" text NOT NULL
);

CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);

ALTER TABLE "cart_items" ADD FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON UPDATE no action ON DELETE cascade;
ALTER TABLE "cart_items" ADD FOREIGN KEY ("canonical_product_id") REFERENCES "canonical_products"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "cart_items" ADD FOREIGN KEY ("added_by") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "cart_members" ADD FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON UPDATE no action ON DELETE cascade;
ALTER TABLE "cart_members" ADD FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "cart_shares" ADD FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON UPDATE no action ON DELETE cascade;
ALTER TABLE "cart_snapshots" ADD FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON UPDATE no action ON DELETE cascade;
ALTER TABLE "carts" ADD FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "favorites" ADD FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "favorites" ADD FOREIGN KEY ("canonical_product_id") REFERENCES "canonical_products"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "price_alerts" ADD FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "price_alerts" ADD FOREIGN KEY ("canonical_product_id") REFERENCES "canonical_products"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "price_history" ADD FOREIGN KEY ("offer_id") REFERENCES "store_offers"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "product_match_candidates" ADD FOREIGN KEY ("store_product_id") REFERENCES "store_products"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "product_match_candidates" ADD FOREIGN KEY ("canonical_product_id") REFERENCES "canonical_products"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "product_specs" ADD FOREIGN KEY ("canonical_product_id") REFERENCES "canonical_products"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "saved_optimizations" ADD FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON UPDATE no action ON DELETE cascade;
ALTER TABLE "scrape_jobs" ADD FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "sessions" ADD FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE cascade;
ALTER TABLE "stock_alerts" ADD FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "stock_alerts" ADD FOREIGN KEY ("canonical_product_id") REFERENCES "canonical_products"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "store_health" ADD FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "store_offers" ADD FOREIGN KEY ("canonical_product_id") REFERENCES "canonical_products"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "store_offers" ADD FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "store_offers" ADD FOREIGN KEY ("store_product_id") REFERENCES "store_products"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "store_products" ADD FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON UPDATE no action ON DELETE no action;
ALTER TABLE "store_shipping_rules" ADD FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON UPDATE no action ON DELETE no action;

CREATE INDEX "products_mpn" ON "canonical_products" ("mpn");
CREATE INDEX "products_category" ON "canonical_products" ("category");
CREATE INDEX "cart_items_cart" ON "cart_items" ("cart_id");
CREATE UNIQUE INDEX "cart_members_unique" ON "cart_members" ("cart_id","user_id");
CREATE INDEX "cart_members_user" ON "cart_members" ("user_id");
CREATE INDEX "shares_cart" ON "cart_shares" ("cart_id");
CREATE INDEX "snapshots_cart" ON "cart_snapshots" ("cart_id");
CREATE INDEX "carts_owner" ON "carts" ("owner_id");
CREATE UNIQUE INDEX "favorite_user_product" ON "favorites" ("user_id","canonical_product_id");
CREATE INDEX "history_offer_time" ON "price_history" ("offer_id","checked_at");
CREATE INDEX "sessions_user" ON "sessions" ("user_id");
CREATE INDEX "health_store" ON "store_health" ("store_id");
CREATE INDEX "offers_product" ON "store_offers" ("canonical_product_id");
CREATE INDEX "offers_store" ON "store_offers" ("store_id");
CREATE INDEX "store_products_store" ON "store_products" ("store_id");
CREATE UNIQUE INDEX "store_product_url" ON "store_products" ("store_id","url");
COMMIT;
