PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_store_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_product_id` text NOT NULL,
	`store_id` text NOT NULL,
	`store_product_id` text NOT NULL,
	`title` text NOT NULL,
	`product_url` text NOT NULL,
	`image_url` text,
	`manufacturer` text NOT NULL,
	`mpn` text NOT NULL,
	`price_net` integer NOT NULL,
	`vat_rate` real,
	`price_gross` integer NOT NULL,
	`package_quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`currency` text NOT NULL,
	`vat_included` integer NOT NULL,
	`stock_status` text NOT NULL,
	`stock_quantity` integer,
	`match_confidence` integer NOT NULL,
	`match_type` text NOT NULL,
	`last_checked_at` text NOT NULL,
	`source` text NOT NULL,
	`minimum_order_quantity` integer DEFAULT 1 NOT NULL,
	`order_step` integer DEFAULT 1 NOT NULL,
	`price_tiers` text DEFAULT '[]' NOT NULL,
	`last_error` text,
	FOREIGN KEY (`canonical_product_id`) REFERENCES `canonical_products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_product_id`) REFERENCES `store_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_store_offers`("id", "canonical_product_id", "store_id", "store_product_id", "title", "product_url", "image_url", "manufacturer", "mpn", "price_net", "vat_rate", "price_gross", "package_quantity", "unit_price", "currency", "vat_included", "stock_status", "stock_quantity", "match_confidence", "match_type", "last_checked_at", "source", "minimum_order_quantity", "order_step", "price_tiers", "last_error") SELECT "id", "canonical_product_id", "store_id", "store_product_id", "title", "product_url", "image_url", "manufacturer", "mpn", "price_net", "vat_rate", "price_gross", "package_quantity", "unit_price", "currency", "vat_included", "stock_status", "stock_quantity", "match_confidence", "match_type", "last_checked_at", "source", "minimum_order_quantity", "order_step", "price_tiers", "last_error" FROM `store_offers`;--> statement-breakpoint
DROP TABLE `store_offers`;--> statement-breakpoint
ALTER TABLE `__new_store_offers` RENAME TO `store_offers`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint
CREATE INDEX `offers_product` ON `store_offers` (`canonical_product_id`);--> statement-breakpoint
CREATE INDEX `offers_store` ON `store_offers` (`store_id`);